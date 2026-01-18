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

    const { allocations } = await request.json();
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

    // Process each allocation
    for (const allocation of allocations) {
      const { userId, leaveType, days, hours, minutes, carryForward, reason } = allocation;

      try {
        // Verify leave type exists first
        const leaveTypeId = new mongoose.Types.ObjectId(leaveType);
        const leaveTypeExists = await LeaveType.findById(leaveTypeId);
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
          // For shortday leave types, check if hours or minutes are provided and valid
          const hoursValue = hours !== undefined && hours !== null ? parseInt(String(hours)) : 0;
          const minutesValue = minutes !== undefined && minutes !== null ? parseInt(String(minutes)) : 0;
          
          if (!userId || !leaveType || (isNaN(hoursValue) && isNaN(minutesValue)) || (hoursValue === 0 && minutesValue === 0)) {
            errors.push({
              userId,
              leaveType,
              error: 'Employee, leave type, and hours/minutes are required for shortday leave',
            });
            continue;
          }
        } else {
          if (!userId || !leaveType || !days) {
            errors.push({
              userId,
              leaveType,
              error: 'Employee, leave type, and days are required',
            });
            continue;
          }
        }

        // Check if this employee already has this leave type allotted
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const existingLeave = await Leave.findOne({
          userId: userIdObj,
          leaveType: leaveTypeId,
          allottedBy: { $exists: true, $ne: null },
        });

        if (existingLeave) {
          errors.push({
            userId,
            leaveType,
            error: `Already allotted ${leaveTypeExists.name}`,
          });
          continue;
        }

        // Calculate start and end dates
        const startDate = new Date();
        const endDate = new Date();
        
        const leaveData: any = {
          userId: userIdObj,
          leaveType: leaveTypeId,
          startDate,
          endDate,
          reason: reason || 'Allotted by admin/HR',
          status: 'approved',
          allottedBy: allottedByObj,
          allottedAt: new Date(),
          approvedBy: allottedByObj,
          approvedAt: new Date(),
          carryForward: carryForward || false,
        };

        if (isShortDayLeaveType) {
          // For shortday leave types, store hours and minutes
          const hoursValue = hours !== undefined && hours !== null ? parseInt(String(hours)) : 0;
          const minutesValue = minutes !== undefined && minutes !== null ? parseInt(String(minutes)) : 0;
          
          // Normalize minutes (convert to hours if >= 60)
          const totalMinutes = hoursValue * 60 + minutesValue;
          const normalizedHours = Math.floor(totalMinutes / 60);
          const normalizedMinutes = totalMinutes % 60;
          
          leaveData.days = 0; // Set days to 0 for shortday leave types
          leaveData.hours = normalizedHours;
          leaveData.minutes = normalizedMinutes;
          leaveData.remainingHours = normalizedHours;
          leaveData.remainingMinutes = normalizedMinutes;
        } else {
          // For regular leave types, use days
          const daysValue = parseInt(String(days));
          if (isNaN(daysValue) || daysValue <= 0) {
            errors.push({
              userId,
              leaveType,
              error: 'Invalid days value',
            });
            continue;
          }
          endDate.setDate(startDate.getDate() + daysValue - 1);
          leaveData.days = daysValue;
          leaveData.remainingDays = daysValue;
        }

        const leave = new Leave(leaveData);

        await leave.save();
        await leave.populate('userId', 'name email profileImage');
        await leave.populate('allottedBy', 'name email profileImage');
        await leave.populate('leaveType', 'name description');

        results.push(leave);
      } catch (error: any) {
        errors.push({
          userId,
          leaveType,
          error: error.message || 'Unknown error',
        });
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

