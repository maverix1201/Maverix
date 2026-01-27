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

    // Prevent HR from approving their own leaves - HR leaves must go to admin for approval
    const userId = (session.user as any).id;
    const leaveUserId = typeof leave.userId === 'object' && leave.userId?._id 
      ? leave.userId._id.toString() 
      : leave.userId.toString();
    
    if (role === 'hr' && leaveUserId === userId) {
      return NextResponse.json({ 
        error: 'HR cannot approve their own leave requests. Please contact admin for approval.' 
      }, { status: 403 });
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
        // Check if this is a shortday leave type
        const LeaveType = (await import('@/models/LeaveType')).default;
        const leaveTypeDoc = await LeaveType.findById(leave.leaveType);
        const leaveTypeName = leaveTypeDoc?.name?.toLowerCase() || '';
        const isShortDayLeaveType = leaveTypeName.includes('shortday') || 
                                     leaveTypeName.includes('short-day') || 
                                     leaveTypeName.includes('short day');

        if (isShortDayLeaveType) {
          // Handle shortday leave types with hours/minutes
          const requestedHours = leave.hours || 0;
          const requestedMinutes = leave.minutes || 0;
          const requestedTotalMinutes = requestedHours * 60 + requestedMinutes;

          if (status === 'approved' && previousStatus !== 'approved') {
            // Deduct from balance when approving
            const approvedRequests = await Leave.find({
              userId: leave.userId,
              leaveType: leave.leaveType,
              allottedBy: { $exists: false },
              status: 'approved',
              _id: { $ne: leave._id },
            }).lean();

            // Calculate total used minutes
            let totalUsedMinutes = 0;
            approvedRequests.forEach((req: any) => {
              const reqHours = req.hours || 0;
              const reqMinutes = req.minutes || 0;
              totalUsedMinutes += reqHours * 60 + reqMinutes;
            });

            // Calculate remaining
            const totalAllottedMinutes = (allottedLeave.hours || 0) * 60 + (allottedLeave.minutes || 0);
            const actualRemainingMinutes = Math.max(0, totalAllottedMinutes - totalUsedMinutes);
            const newRemainingMinutes = actualRemainingMinutes - requestedTotalMinutes;

            // Update remaining hours and minutes
            allottedLeave.remainingHours = Math.floor(newRemainingMinutes / 60);
            allottedLeave.remainingMinutes = newRemainingMinutes % 60;
            await allottedLeave.save();

            // Create deduction history entry for shortday leave (not treated as "on leave")
            const deductionHistory = new Leave({
              userId: leave.userId,
              leaveType: leave.leaveType,
              hours: requestedHours,
              minutes: requestedMinutes,
              startDate: leave.startDate,
              endDate: leave.endDate,
              reason: `Leave deduction: ${requestedHours}h ${requestedMinutes}m deducted from allotted ${leaveTypeDoc?.name || 'leave'} balance`,
              status: 'approved',
              allottedBy: (session.user as any).id, // Mark as system-generated deduction history
              allottedAt: new Date(),
              approvedBy: (session.user as any).id,
              approvedAt: new Date(),
            });
            await deductionHistory.save();
          } else if (status === 'rejected' && previousStatus === 'approved') {
            // Restore balance if rejecting a previously approved leave
            const approvedRequests = await Leave.find({
              userId: leave.userId,
              leaveType: leave.leaveType,
              allottedBy: { $exists: false },
              status: 'approved',
              _id: { $ne: leave._id },
            }).lean();

            // Calculate total used minutes (excluding this leave)
            let totalUsedMinutes = 0;
            approvedRequests.forEach((req: any) => {
              const reqHours = req.hours || 0;
              const reqMinutes = req.minutes || 0;
              totalUsedMinutes += reqHours * 60 + reqMinutes;
            });

            // Calculate remaining
            const totalAllottedMinutes = (allottedLeave.hours || 0) * 60 + (allottedLeave.minutes || 0);
            const actualRemainingMinutes = Math.max(0, totalAllottedMinutes - totalUsedMinutes);

            // Update remaining hours and minutes
            allottedLeave.remainingHours = Math.floor(actualRemainingMinutes / 60);
            allottedLeave.remainingMinutes = actualRemainingMinutes % 60;
            await allottedLeave.save();
          }
        } else {
          // Handle regular leave types with days
          const requestedDays = leave.days || 0;

          if (status === 'approved' && previousStatus !== 'approved') {
            // Deduct from balance when approving
            const approvedRequests = await Leave.find({
              userId: leave.userId,
              leaveType: leave.leaveType,
              allottedBy: { $exists: false },
              status: 'approved',
              _id: { $ne: leave._id },
            }).lean();

            const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
            const actualRemainingDays = Math.max(0, (allottedLeave.days || 0) - totalUsed);

            // Update remainingDays in allotted leave
            allottedLeave.remainingDays = actualRemainingDays - requestedDays;
            await allottedLeave.save();

            // Create deduction history entry (not treated as "on leave")
            const deductionHistory = new Leave({
              userId: leave.userId,
              leaveType: leave.leaveType,
              days: requestedDays,
              startDate: leave.startDate,
              endDate: leave.endDate,
              reason: `Leave deduction: ${requestedDays} day(s) deducted from allotted ${leaveTypeDoc?.name || 'leave'} balance`,
              status: 'approved',
              allottedBy: (session.user as any).id, // Mark as system-generated deduction history
              allottedAt: new Date(),
              approvedBy: (session.user as any).id,
              approvedAt: new Date(),
            });
            await deductionHistory.save();
          } else if (status === 'rejected' && previousStatus === 'approved') {
            // Restore balance if rejecting a previously approved leave
            const approvedRequests = await Leave.find({
              userId: leave.userId,
              leaveType: leave.leaveType,
              allottedBy: { $exists: false },
              status: 'approved',
              _id: { $ne: leave._id },
            }).lean();

            const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
            allottedLeave.remainingDays = Math.max(0, (allottedLeave.days || 0) - totalUsed);
            await allottedLeave.save();
          }
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
        // Check if this is a shortday leave type
        const leaveTypeName = (leaveType.name as string)?.toLowerCase() || '';
        const isShortDayLeaveType = leaveTypeName.includes('shortday') || 
                                   leaveTypeName.includes('short-day') || 
                                   leaveTypeName.includes('short day');
        
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
          hours: isShortDayLeaveType ? ((updatedLeave as any).hours || 0) : undefined, // Include hours for shortday leaves
          minutes: isShortDayLeaveType ? ((updatedLeave as any).minutes || 0) : undefined, // Include minutes for shortday leaves
        });
      }
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error('Error sending leave status notification email:', emailError);
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
      const daysValue = parseFloat(String(days));
      if (isNaN(daysValue) || daysValue <= 0) {
        return NextResponse.json(
          { error: 'Invalid days value' },
          { status: 400 }
        );
      }
      leave.days = daysValue;
      // Update remaining days if it exists
      if (leave.remainingDays !== undefined) {
        leave.remainingDays = daysValue;
      }
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

