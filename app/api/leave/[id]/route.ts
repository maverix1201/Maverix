import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
import mongoose from 'mongoose';
import { sendLeaveStatusNotificationToEmployee } from '@/utils/sendEmail';
import { format } from 'date-fns';

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

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid leave ID' }, { status: 400 });
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

    // Handle balance deduction/restoration (only when approving/rejecting)
    if (!leave.allottedBy) {
      // This is a leave request (not an allotted leave)
      const allottedLeave = await Leave.findOne({
        userId: leave.userId,
        leaveType: leave.leaveType,
        allottedBy: { $exists: true, $ne: null },
      });

      if (allottedLeave) {
        const requestedDays = leave.days || 0;

        if (status === 'approved' && previousStatus !== 'approved') {
          // Deduct from balance when approving
          // Calculate actual remaining days based on approved requests
          const approvedRequests = await Leave.find({
            userId: leave.userId,
            leaveType: leave.leaveType,
            allottedBy: { $exists: false },
            status: 'approved',
            _id: { $ne: leave._id }, // Exclude current request
          }).lean();

          const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
          const actualRemainingDays = Math.max(0, (allottedLeave.days || 0) - totalUsed);

          // Update remainingDays in allotted leave
          allottedLeave.remainingDays = actualRemainingDays - requestedDays;
          await allottedLeave.save();
        } else if (status === 'rejected' && previousStatus === 'approved') {
          // Restore balance if rejecting a previously approved leave
          // Recalculate remaining days
          const approvedRequests = await Leave.find({
            userId: leave.userId,
            leaveType: leave.leaveType,
            allottedBy: { $exists: false },
            status: 'approved',
            _id: { $ne: leave._id }, // Exclude current request
          }).lean();

          const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
          allottedLeave.remainingDays = Math.max(0, (allottedLeave.days || 0) - totalUsed);
          await allottedLeave.save();
        }
      }
    }

    await leave.save();
    
    // Populate the leave with related data before returning
    await leave.populate('userId', 'name email profileImage');
    await leave.populate('leaveType', 'name description');
    if (leave.approvedBy) {
      await leave.populate('approvedBy', 'name email');
    }

    // Send email notification to employee about approval/rejection
    try {
      const user = typeof leave.userId === 'object' && leave.userId ? leave.userId : null;
      const leaveType = typeof leave.leaveType === 'object' && leave.leaveType ? leave.leaveType : null;
      const approver = typeof leave.approvedBy === 'object' && leave.approvedBy ? leave.approvedBy : null;

      if (user && leaveType && user.email) {
        await sendLeaveStatusNotificationToEmployee({
          employeeName: user.name || 'Employee',
          employeeEmail: user.email,
          leaveType: leaveType.name || 'Leave',
          days: leave.days || 0,
          startDate: format(new Date(leave.startDate), 'MMM dd, yyyy'),
          endDate: format(new Date(leave.endDate), 'MMM dd, yyyy'),
          status: status as 'approved' | 'rejected',
          rejectionReason: status === 'rejected' ? leave.rejectionReason : undefined,
          approvedBy: approver ? approver.name : undefined,
        });
      }
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error('Error sending leave status notification email:', emailError);
    }

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

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid leave ID' }, { status: 400 });
    }

    await connectDB();

    const leave = await Leave.findById(params.id);

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    // Employees can only delete their own pending leave requests
    // Admin/HR can delete any leave request
    if (role === 'employee') {
      const leaveUserId = typeof leave.userId === 'object' && leave.userId?._id 
        ? leave.userId._id.toString() 
        : leave.userId.toString();
      
      if (leaveUserId !== userId) {
        return NextResponse.json({ error: 'You can only delete your own leave requests' }, { status: 403 });
      }

      if (leave.status !== 'pending') {
        return NextResponse.json({ error: 'You can only delete pending leave requests' }, { status: 400 });
      }
    } else if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await Leave.findByIdAndDelete(params.id);

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

