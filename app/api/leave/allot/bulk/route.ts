import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { allocations, deletedLeaveIds } = await request.json();
    const allottedBy = (session.user as any).id;

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json(
        { error: 'Allocations array is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const LeaveType = (await import('@/models/LeaveType')).default;
    const allottedByObj = new mongoose.Types.ObjectId(allottedBy);
    const results: any[] = [];
    const errors: any[] = [];

    // Performance optimization: Pre-fetch all unique leave types in a single query
    const uniqueLeaveTypeIds = [...new Set(allocations.map(a => a.leaveType))];
    const leaveTypeIds = uniqueLeaveTypeIds.map(id => new mongoose.Types.ObjectId(id));
    const leaveTypesMap = new Map();
    
    const leaveTypes = await LeaveType.find({ _id: { $in: leaveTypeIds } }).lean();
    leaveTypes.forEach((lt: any) => {
      leaveTypesMap.set(lt._id.toString(), lt);
    });

    // Performance optimization: Pre-check all existing leaves in a single query
    // Exclude deleted leave IDs if provided (for edit mode)
    const userIds = [...new Set(allocations.map(a => a.userId))];
    const userIdObjs = userIds.map(id => new mongoose.Types.ObjectId(id));
    
    const existingLeavesQuery: any = {
      userId: { $in: userIdObjs },
      leaveType: { $in: leaveTypeIds },
      allottedBy: { $exists: true, $ne: null },
    };
    
    // Exclude deleted leave IDs from the check (for edit mode)
    if (deletedLeaveIds && Array.isArray(deletedLeaveIds) && deletedLeaveIds.length > 0) {
      const deletedIds = deletedLeaveIds.map((id: string) => new mongoose.Types.ObjectId(id));
      existingLeavesQuery._id = { $nin: deletedIds };
    }
    
    const existingLeaves = await Leave.find(existingLeavesQuery).select('userId leaveType').lean();
    
    // Create a Set for fast lookup: "userId-leaveTypeId"
    const existingLeavesSet = new Set(
      existingLeaves.map((el: any) => 
        `${el.userId.toString()}-${el.leaveType.toString()}`
      )
    );

    // Prepare all leave documents for bulk insert
    const leaveDocuments: any[] = [];
    const allocationMetadata: Map<number, { userId: string; leaveType: string }> = new Map();
    const startDate = new Date();
    const currentTime = new Date();

    // Process all allocations and prepare documents
    for (let i = 0; i < allocations.length; i++) {
      const allocation = allocations[i];
      const { userId, leaveType, days, hours, minutes, carryForward, reason } = allocation;

      try {
        // Validate userId and leaveType
        if (!userId || !leaveType) {
          errors.push({
            userId: userId || 'unknown',
            leaveType: leaveType || 'unknown',
            error: 'Employee and leave type are required',
          });
          continue;
        }

        const leaveTypeId = new mongoose.Types.ObjectId(leaveType);
        const leaveTypeExists = leaveTypesMap.get(leaveType);

        if (!leaveTypeExists) {
          errors.push({
            userId,
            leaveType,
            error: 'Invalid leave type',
          });
          continue;
        }

        // Check if this is a shortday leave type
        const leaveTypeName = leaveTypeExists.name?.toLowerCase() || '';
        const isShortDayLeaveType = leaveTypeName.includes('shortday') || 
                                     leaveTypeName.includes('short-day') || 
                                     leaveTypeName.includes('short day');

        // Validate required fields based on leave type
        if (isShortDayLeaveType) {
          const hoursValue = hours !== undefined && hours !== null ? parseInt(String(hours)) : 0;
          const minutesValue = minutes !== undefined && minutes !== null ? parseInt(String(minutes)) : 0;
          
          if ((isNaN(hoursValue) && isNaN(minutesValue)) || (hoursValue === 0 && minutesValue === 0)) {
            errors.push({
              userId,
              leaveType,
              error: 'Employee, leave type, and hours/minutes are required for shortday leave',
            });
            continue;
          }
        } else {
          if (!days) {
            errors.push({
              userId,
              leaveType,
              error: 'Employee, leave type, and days are required',
            });
            continue;
          }
        }

        // Check if this employee already has this leave type allotted (using pre-fetched data)
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const existingKey = `${userId}-${leaveType}`;
        if (existingLeavesSet.has(existingKey)) {
          errors.push({
            userId,
            leaveType,
            error: `Already allotted ${leaveTypeExists.name}`,
          });
          continue;
        }

        // Calculate end date (create new Date instance for each allocation)
        const allocationStartDate = new Date(startDate);
        const endDate = new Date(allocationStartDate);
        
        const leaveData: any = {
          userId: userIdObj,
          leaveType: leaveTypeId,
          startDate: allocationStartDate,
          endDate,
          reason: reason || 'Allotted by admin/HR',
          status: 'approved',
          allottedBy: allottedByObj,
          allottedAt: currentTime,
          approvedBy: allottedByObj,
          approvedAt: currentTime,
          carryForward: carryForward || false,
        };

        if (isShortDayLeaveType) {
          const hoursValue = hours !== undefined && hours !== null ? parseInt(String(hours)) : 0;
          const minutesValue = minutes !== undefined && minutes !== null ? parseInt(String(minutes)) : 0;
          
          const totalMinutes = hoursValue * 60 + minutesValue;
          const normalizedHours = Math.floor(totalMinutes / 60);
          const normalizedMinutes = totalMinutes % 60;
          
          leaveData.days = 0;
          leaveData.hours = normalizedHours;
          leaveData.minutes = normalizedMinutes;
          leaveData.remainingHours = normalizedHours;
          leaveData.remainingMinutes = normalizedMinutes;
        } else {
          const daysValue = parseFloat(String(days));
          if (isNaN(daysValue) || daysValue <= 0) {
            errors.push({
              userId,
              leaveType,
              error: 'Invalid days value',
            });
            continue;
          }
          const daysToAdd = Math.ceil(daysValue) - 1;
          endDate.setDate(allocationStartDate.getDate() + daysToAdd);
          leaveData.days = daysValue;
          leaveData.remainingDays = daysValue;
        }

        leaveDocuments.push(leaveData);
        allocationMetadata.set(leaveDocuments.length - 1, { userId, leaveType });
      } catch (error: any) {
        errors.push({
          userId: userId || 'unknown',
          leaveType: leaveType || 'unknown',
          error: error.message || 'Unknown error',
        });
      }
    }

    // Performance optimization: Bulk insert all leaves at once
    if (leaveDocuments.length > 0) {
      try {
        const insertedLeaves = await Leave.insertMany(leaveDocuments, { ordered: false });
        
        // Batch populate all inserted leaves
        const populatedLeaves = await Leave.find({
          _id: { $in: insertedLeaves.map(l => l._id) }
        })
          .populate('userId', 'name email profileImage')
          .populate('allottedBy', 'name email profileImage')
          .populate('leaveType', 'name description')
          .lean();
        
        results.push(...populatedLeaves);
      } catch (bulkError: any) {
        // If bulk insert fails, fall back to individual inserts for better error reporting
        console.warn('Bulk insert failed, falling back to individual inserts:', bulkError.message);
        
        for (let i = 0; i < leaveDocuments.length; i++) {
          try {
            const leave = new Leave(leaveDocuments[i]);
            await leave.save();
            await leave.populate('userId', 'name email profileImage');
            await leave.populate('allottedBy', 'name email profileImage');
            await leave.populate('leaveType', 'name description');
            results.push(leave);
          } catch (individualError: any) {
            const metadata = allocationMetadata.get(i);
            errors.push({
              userId: metadata?.userId || 'unknown',
              leaveType: metadata?.leaveType || 'unknown',
              error: individualError.message || 'Failed to save leave',
            });
          }
        }
      }
    }

    return NextResponse.json({
      message: `Successfully allotted ${results.length} leave(s)`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      successCount: results.length,
      errorCount: errors.length,
    });
  } catch (error: any) {
    console.error('Bulk allot leave error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

