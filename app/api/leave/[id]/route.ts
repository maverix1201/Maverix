import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
import Notification from '@/models/Notification';
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

    // Handle balance deduction/restoration BEFORE updating status
    // This must be done before the status change to calculate correctly
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
          // Recalculate remaining days (excluding this leave since it will be rejected)
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

    // Prepare update object
    const updateData: any = {
      status: status,
      approvedBy: (session.user as any).id,
      approvedAt: new Date(),
    };

    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    } else if (status === 'approved') {
      // Clear rejection reason if approving
      updateData.rejectionReason = null;
    }

    // Use findByIdAndUpdate for reliable status update
    const updatedLeave = await Leave.findByIdAndUpdate(
      params.id,
      updateData,
      { 
        new: true, // Return updated document
        runValidators: true, // Run schema validators
        overwrite: false, // Don't overwrite entire document
      }
    );

    if (!updatedLeave) {
      return NextResponse.json({ error: 'Leave not found after update' }, { status: 404 });
    }

    // Verify the status was actually updated
    if (updatedLeave.status !== status) {
      console.error(`Status update failed: Expected ${status}, got ${updatedLeave.status}. Retrying...`);
      // Retry with explicit status update
      const retryUpdate = await Leave.findByIdAndUpdate(
        params.id,
        { $set: { status: status } },
        { new: true, runValidators: true }
      );
      if (retryUpdate && retryUpdate.status !== status) {
        return NextResponse.json({ 
          error: `Failed to update leave status. Expected ${status} but got ${retryUpdate.status}` 
        }, { status: 500 });
      }
    }
    
    // Populate the leave with related data before returning
    await updatedLeave.populate('userId', 'name email profileImage');
    await updatedLeave.populate('leaveType', 'name description');
    if (updatedLeave.approvedBy) {
      await updatedLeave.populate('approvedBy', 'name email');
    }

    // Send email notification to employee about approval/rejection
    try {
      const user = typeof updatedLeave.userId === 'object' && updatedLeave.userId && 'email' in updatedLeave.userId ? updatedLeave.userId as any : null;
      const leaveType = typeof updatedLeave.leaveType === 'object' && updatedLeave.leaveType && 'name' in updatedLeave.leaveType ? updatedLeave.leaveType as any : null;
      const approver = typeof updatedLeave.approvedBy === 'object' && updatedLeave.approvedBy && 'name' in updatedLeave.approvedBy ? updatedLeave.approvedBy as any : null;

      if (user && leaveType && 'email' in user && user.email) {
        await sendLeaveStatusNotificationToEmployee({
          employeeName: (user.name as string) || 'Employee',
          employeeEmail: user.email as string,
          leaveType: (leaveType.name as string) || 'Leave',
          days: updatedLeave.days || 0,
          startDate: format(new Date(updatedLeave.startDate), 'MMM dd, yyyy'),
          endDate: format(new Date(updatedLeave.endDate), 'MMM dd, yyyy'),
          status: status as 'approved' | 'rejected',
          rejectionReason: status === 'rejected' ? updatedLeave.rejectionReason : undefined,
          approvedBy: approver ? (approver.name as string) : undefined,
          halfDayType: (updatedLeave as any).halfDayType, // Include half-day type if present
          shortDayTime: (updatedLeave as any).shortDayTime, // Include short-day time if present
        });
      }
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error('Error sending leave status notification email:', emailError);
    }

    // Create notification for the employee
    try {
      const user = typeof updatedLeave.userId === 'object' && updatedLeave.userId && 'email' in updatedLeave.userId ? updatedLeave.userId as any : null;
      const leaveType = typeof updatedLeave.leaveType === 'object' && updatedLeave.leaveType && 'name' in updatedLeave.leaveType ? updatedLeave.leaveType as any : null;
      const approver = typeof updatedLeave.approvedBy === 'object' && updatedLeave.approvedBy && 'name' in updatedLeave.approvedBy ? updatedLeave.approvedBy as any : null;

      if (user && 'email' in user && user.email && updatedLeave.userId) {
        const notificationType = status === 'approved' ? 'leave_approved' : 'leave_rejected';
        const title = status === 'approved' 
          ? 'Leave Request Approved' 
          : 'Leave Request Rejected';
        
        const leaveTypeName = leaveType ? (leaveType.name as string) : 'Leave';
        const daysText = updatedLeave.days === 0.5 
          ? '0.5 day' 
          : updatedLeave.days < 1 
          ? `${updatedLeave.days.toFixed(2)} day` 
          : `${updatedLeave.days} ${updatedLeave.days === 1 ? 'day' : 'days'}`;
        
        const message = status === 'approved'
          ? `Your ${leaveTypeName} request for ${daysText} from ${format(new Date(updatedLeave.startDate), 'MMM dd, yyyy')} to ${format(new Date(updatedLeave.endDate), 'MMM dd, yyyy')} has been approved${approver ? ` by ${approver.name}` : ''}.`
          : `Your ${leaveTypeName} request for ${daysText} from ${format(new Date(updatedLeave.startDate), 'MMM dd, yyyy')} to ${format(new Date(updatedLeave.endDate), 'MMM dd, yyyy')} has been rejected${approver ? ` by ${approver.name}` : ''}.${updatedLeave.rejectionReason ? ` Reason: ${updatedLeave.rejectionReason}` : ''}`;

        const notification = new Notification({
          userId: updatedLeave.userId,
          type: notificationType,
          title,
          message,
          leaveId: updatedLeave._id,
          dismissed: false,
        });

        await notification.save();
      }
    } catch (notificationError) {
      // Log notification error but don't fail the request
      console.error('Error creating notification:', notificationError);
    }

    return NextResponse.json({
      message: `Leave ${status} successfully`,
      leave: updatedLeave,
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

