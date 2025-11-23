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
      const { userId, leaveType, days, carryForward, reason } = allocation;

      if (!userId || !leaveType || !days) {
        errors.push({
          userId,
          leaveType,
          error: 'Employee, leave type, and days are required',
        });
        continue;
      }

      try {
        // Verify leave type exists
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

        // Calculate start and end dates based on days
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + parseInt(days) - 1);

        const daysValue = parseInt(days);
        const leave = new Leave({
          userId: userIdObj,
          leaveType: leaveTypeId,
          days: daysValue,
          remainingDays: daysValue,
          startDate,
          endDate,
          reason: reason || 'Allotted by admin/HR',
          status: 'approved',
          allottedBy: allottedByObj,
          allottedAt: new Date(),
          approvedBy: allottedByObj,
          approvedAt: new Date(),
          carryForward: carryForward || false,
        });

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

