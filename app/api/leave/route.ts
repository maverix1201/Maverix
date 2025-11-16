import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
import LeaveType from '@/models/LeaveType';
import User from '@/models/User';
import mongoose from 'mongoose';
import { sendLeaveRequestNotificationToHR } from '@/utils/sendEmail';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    let query: any = {};

    if (role === 'employee') {
      // Employees can see both allotted leaves and their leave requests
      query.userId = userId;
    }

    const leaves = await Leave.find(query)
      .populate('userId', 'name email profileImage')
      .populate('allottedBy', 'name email profileImage')
      .populate('leaveType', 'name description')
      .sort({ createdAt: -1 })
      .lean();

    // For allotted leaves, ensure remainingDays is calculated if missing
    if (role === 'employee') {
      for (const leave of leaves) {
        if (leave.allottedBy && (leave.remainingDays === undefined || leave.remainingDays === null)) {
          // Get the actual ObjectId (handle both populated and non-populated cases)
          const userId = typeof leave.userId === 'object' && leave.userId?._id 
            ? leave.userId._id 
            : leave.userId;
          const leaveTypeId = typeof leave.leaveType === 'object' && leave.leaveType?._id 
            ? leave.leaveType._id 
            : leave.leaveType;

          // Calculate remaining days based on approved requests
          const approvedRequests = await Leave.find({
            userId: new mongoose.Types.ObjectId(userId),
            leaveType: new mongoose.Types.ObjectId(leaveTypeId),
            status: 'approved',
            allottedBy: { $exists: false },
          }).lean();

          const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
          leave.remainingDays = Math.max(0, (leave.days || 0) - totalUsed);

          // Update in database
          await Leave.findByIdAndUpdate(leave._id, { remainingDays: leave.remainingDays });
        }
      }
    }

    return NextResponse.json({ leaves });
  } catch (error: any) {
    console.error('Get leaves error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leaveType, startDate, endDate, reason } = await request.json();
    const userId = (session.user as any).id;

    if (!leaveType || !startDate || !endDate || !reason) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify leave type exists and convert to ObjectId
    const LeaveType = (await import('@/models/LeaveType')).default;
    const leaveTypeId = new mongoose.Types.ObjectId(leaveType);
    const leaveTypeExists = await LeaveType.findById(leaveTypeId);
    if (!leaveTypeExists) {
      return NextResponse.json({ error: 'Invalid leave type' }, { status: 400 });
    }

    // Calculate days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // For employees, verify that this leave type has been allotted to them and check balance
    if ((session.user as any).role === 'employee') {
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const allottedLeave = await Leave.findOne({
        userId: userIdObj,
        leaveType: leaveTypeId,
        allottedBy: { $exists: true, $ne: null },
      });

      if (!allottedLeave) {
        return NextResponse.json(
          { error: 'This leave type has not been allotted to you' },
          { status: 400 }
        );
      }

      // Calculate remaining days (considering pending and approved requests)
      let remainingDays = allottedLeave.remainingDays;
      if (remainingDays === undefined || remainingDays === null) {
        remainingDays = allottedLeave.days || 0;
      }

      // Get all approved requests for this leave type (to calculate used balance)
      const approvedRequests = await Leave.find({
        userId: userIdObj,
        leaveType: leaveTypeId,
        allottedBy: { $exists: false },
        status: 'approved', // Only count approved requests for balance calculation
      }).lean();

      // Calculate total used days
      const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
      
      // Calculate actual remaining days
      const actualRemainingDays = Math.max(0, (allottedLeave.days || 0) - totalUsed);

      // Check if balance is sufficient
      if (actualRemainingDays < days) {
        return NextResponse.json(
          { error: `Insufficient leave balance. You have ${actualRemainingDays} days remaining, but requested ${days} days.` },
          { status: 400 }
        );
      }
    }

    const leave = new Leave({
      userId,
      leaveType: leaveTypeId,
      days,
      startDate: start,
      endDate: end,
      reason,
      status: 'pending', // Always pending - requires admin/HR approval
    });

    await leave.save();
    await leave.populate('userId', 'name email profileImage');
    await leave.populate('leaveType', 'name description');

    // Send email notification to HR and Admin (only for employee requests)
    if ((session.user as any).role === 'employee') {
      try {
        // Get all HR and Admin emails
        const hrAndAdminUsers = await User.find({
          role: { $in: ['hr', 'admin'] },
          emailVerified: true,
        }).select('email').lean();

        const hrAndAdminEmails = hrAndAdminUsers.map((user: any) => user.email).filter(Boolean);

        if (hrAndAdminEmails.length > 0) {
          const user = typeof leave.userId === 'object' && leave.userId ? leave.userId : null;
          const leaveType = typeof leave.leaveType === 'object' && leave.leaveType ? leave.leaveType : null;

          if (user && leaveType) {
            await sendLeaveRequestNotificationToHR(hrAndAdminEmails, {
              employeeName: user.name || 'Employee',
              employeeEmail: user.email || '',
              profileImage: user.profileImage,
              leaveType: leaveType.name || 'Leave',
              reason: leave.reason || '',
              days: leave.days || 0,
              startDate: format(new Date(leave.startDate), 'MMM dd, yyyy'),
              endDate: format(new Date(leave.endDate), 'MMM dd, yyyy'),
            });
          }
        }
      } catch (emailError) {
        // Log email error but don't fail the request
        console.error('Error sending leave request notification email:', emailError);
      }
    }

    return NextResponse.json({
      message: 'Leave request submitted successfully',
      leave,
    });
  } catch (error: any) {
    console.error('Create leave error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

