import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;

    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status, rejectionReason } = await request.json();

    if (!status || (status !== 'approved' && status !== 'rejected')) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await connectDB();

    const leave = await Leave.findById(params.id);

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    // Store previous status BEFORE updating
    const previousStatus = leave.status;

    leave.status = status;
    leave.approvedBy = (session.user as any).id;
    leave.approvedAt = new Date();

    if (status === 'rejected' && rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }

    // Handle balance deduction/restoration
    if (!leave.allottedBy) {
      // This is a leave request (not an allotted leave)
      const allottedLeave = await Leave.findOne({
        userId: leave.userId,
        leaveType: leave.leaveType,
        allottedBy: { $exists: true, $ne: null },
      });

      if (allottedLeave) {
        const requestedDays = leave.days || 0;

        // Initialize remainingDays if not set
        if (allottedLeave.remainingDays === undefined || allottedLeave.remainingDays === null) {
          allottedLeave.remainingDays = allottedLeave.days || 0;
        }

        if (status === 'approved' && previousStatus !== 'approved') {
          // Deduct from balance when approving
          if (allottedLeave.remainingDays >= requestedDays) {
            allottedLeave.remainingDays -= requestedDays;
            await allottedLeave.save();
          } else {
            return NextResponse.json(
              { error: 'Insufficient leave balance' },
              { status: 400 }
            );
          }
        } else if (status === 'rejected' && previousStatus === 'approved') {
          // Restore balance if rejecting a previously approved leave
          allottedLeave.remainingDays += requestedDays;
          await allottedLeave.save();
        }
      }
    }

    await leave.save();

    return NextResponse.json({
      message: `Leave ${status} successfully`,
      leave,
    });
  } catch (error: any) {
    console.error('Update leave error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;

    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const leave = await Leave.findByIdAndDelete(params.id);

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Leave deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete leave error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;

    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { days, startDate, endDate, reason, carryForward, leaveType } = await request.json();

    await connectDB();

    const leave = await Leave.findById(params.id);

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    // Only allow editing allotted leaves
    if (!leave.allottedBy) {
      return NextResponse.json({ error: 'Cannot edit non-allotted leave' }, { status: 400 });
    }

    // If leaveType is being changed, check for duplicates
    if (leaveType && leaveType !== leave.leaveType.toString()) {
      const leaveTypeId = new mongoose.Types.ObjectId(leaveType);
      const existingLeave = await Leave.findOne({
        userId: leave.userId,
        leaveType: leaveTypeId,
        allottedBy: { $exists: true, $ne: null },
        _id: { $ne: leave._id },
      });

      if (existingLeave) {
        const LeaveType = (await import('@/models/LeaveType')).default;
        const leaveTypeDoc = await LeaveType.findById(leaveTypeId);
        return NextResponse.json(
          { error: `Already allotted ${leaveTypeDoc?.name || 'this leave type'}` },
          { status: 400 }
        );
      }

      leave.leaveType = leaveTypeId;
    }

    if (days !== undefined) {
      leave.days = parseInt(days);
    }

    if (startDate) {
      leave.startDate = new Date(startDate);
    }

    if (endDate) {
      leave.endDate = new Date(endDate);
    }

    if (reason !== undefined) {
      leave.reason = reason;
    }

    if (carryForward !== undefined) {
      leave.carryForward = carryForward;
    }

    await leave.save();
    await leave.populate('userId', 'name email profileImage');
    await leave.populate('allottedBy', 'name email profileImage');
    await leave.populate('leaveType', 'name description');

    return NextResponse.json({
      message: 'Leave updated successfully',
      leave,
    });
  } catch (error: any) {
    console.error('Update leave error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

