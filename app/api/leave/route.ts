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
    const allLeaves = request.nextUrl.searchParams.get('all') === 'true';

    let query: any = {};

    if (role === 'employee' || (role === 'hr' && !allLeaves)) {
      // Employees and HR (when not requesting all leaves) can see both allotted leaves and their leave requests
      query.userId = userId;
    }
    // Admin and HR (when requesting all leaves for leave allotment page) can see all leaves

    // Exclude penalty-related leaves and deduction history entries (leaves deducted for late clock-in penalties and balance deductions)
    const leavesQuery = {
      ...query,
      $or: [
        { reason: { $exists: false } },
        { reason: { $not: { $regex: /penalty|late.*clock.*in|exceeded.*max.*late|leave.*deduction/i } } },
      ],
    };

    const leaves = await Leave.find(leavesQuery)
      .populate('userId', 'name email profileImage')
      .populate('allottedBy', 'name email profileImage')
      .populate('leaveType', 'name description')
      .sort({ createdAt: -1 })
      .lean();

    // Additional filter to exclude penalty-related leaves
    const filteredLeaves = leaves.filter((leave: any) => {
      if (leave.reason && /penalty|late.*clock.*in|exceeded.*max.*late/i.test(leave.reason)) {
        return false;
      }
      return true;
    });

    // For allotted leaves, always recalculate remainingDays to ensure it includes penalty deductions
    // This applies to all roles to ensure accurate leave balances are displayed
    for (const leave of filteredLeaves) {
      if (leave.allottedBy) {
        // Get the actual ObjectId (handle both populated and non-populated cases)
        const userId = typeof leave.userId === 'object' && leave.userId?._id 
          ? leave.userId._id 
          : leave.userId;
        const leaveTypeId = typeof leave.leaveType === 'object' && leave.leaveType?._id 
          ? leave.leaveType._id 
          : leave.leaveType;

        // Check if this is a shortday leave type
        const LeaveType = (await import('@/models/LeaveType')).default;
        const leaveTypeDoc = await LeaveType.findById(leaveTypeId);
        const leaveTypeName = leaveTypeDoc?.name?.toLowerCase() || '';
        const isShortDayLeaveType = leaveTypeName.includes('shortday') || 
                                     leaveTypeName.includes('short-day') || 
                                     leaveTypeName.includes('short day');

        const approvedRequests = await Leave.find({
          userId: new mongoose.Types.ObjectId(userId),
          leaveType: new mongoose.Types.ObjectId(leaveTypeId),
          status: 'approved',
          allottedBy: { $exists: false },
        }).lean();

        if (isShortDayLeaveType) {
          // Calculate remaining hours/minutes for shortday leave types
          let totalUsedMinutes = 0;
          approvedRequests.forEach((req: any) => {
            const reqHours = req.hours || 0;
            const reqMinutes = req.minutes || 0;
            totalUsedMinutes += reqHours * 60 + reqMinutes;
          });

          const totalAllottedMinutes = (leave.hours || 0) * 60 + (leave.minutes || 0);
          const calculatedRemainingMinutes = Math.max(0, totalAllottedMinutes - totalUsedMinutes);
          
          // Update remaining hours and minutes
          leave.remainingHours = Math.floor(calculatedRemainingMinutes / 60);
          leave.remainingMinutes = calculatedRemainingMinutes % 60;

          // Update in database
          await Leave.findByIdAndUpdate(leave._id, {
            remainingHours: leave.remainingHours,
            remainingMinutes: leave.remainingMinutes,
          });
        } else {
          // Calculate remaining days for regular leave types
          const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
          const calculatedRemainingDays = Math.max(0, (leave.days || 0) - totalUsed);
          
          // Always update remainingDays to ensure it reflects current state including penalties
          leave.remainingDays = calculatedRemainingDays;

          // Update in database
          await Leave.findByIdAndUpdate(leave._id, { remainingDays: calculatedRemainingDays });
        }
      }
    }

    const response = NextResponse.json({ leaves: filteredLeaves });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    return response;
  } catch (error: any) {
    console.error('Get leaves error:', error);
    const errorResponse = NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    return errorResponse;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leaveType, startDate, endDate, reason, halfDayType, shortDayTime, shortDayFromTime, shortDayToTime, medicalReport } = await request.json();
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
    
    // Check if this is a half-day or short-day leave
    const isHalfDay = halfDayType && (halfDayType === 'first-half' || halfDayType === 'second-half');
    const isShortDay = (shortDayTime && shortDayTime.trim() !== '') || (shortDayFromTime && shortDayToTime);
    
    // Check if leave type is shortday by name
    const leaveTypeName = leaveTypeExists.name?.toLowerCase() || '';
    const isShortDayLeaveType = leaveTypeName.includes('shortday') || 
                                 leaveTypeName.includes('short-day') || 
                                 leaveTypeName.includes('short day');
    
    // For short-day, combine from and to times into a single string format "HH:MM-HH:MM"
    let finalShortDayTime: string | undefined;
    let calculatedHours: number = 0;
    let calculatedMinutes: number = 0;
    
    if (isShortDay) {
      if (shortDayFromTime && shortDayToTime) {
        finalShortDayTime = `${shortDayFromTime}-${shortDayToTime}`;
        const fromTime = new Date(`2000-01-01T${shortDayFromTime}`);
        const toTime = new Date(`2000-01-01T${shortDayToTime}`);
        const diffMs = toTime.getTime() - fromTime.getTime();
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        calculatedHours = Math.floor(totalMinutes / 60);
        calculatedMinutes = totalMinutes % 60;
      } else if (shortDayTime) {
        finalShortDayTime = shortDayTime; // Backward compatibility
        // Try to parse existing format
        if (shortDayTime.includes('-')) {
          const [from, to] = shortDayTime.split('-');
          const fromTime = new Date(`2000-01-01T${from}`);
          const toTime = new Date(`2000-01-01T${to}`);
          const diffMs = toTime.getTime() - fromTime.getTime();
          const totalMinutes = Math.floor(diffMs / (1000 * 60));
          calculatedHours = Math.floor(totalMinutes / 60);
          calculatedMinutes = totalMinutes % 60;
        }
      }
    }
    
    // Calculate days based on leave type
    let days: number;
    if (isHalfDay) {
      days = 0.5;
    } else if (isShortDay) {
      // For shortday leave types, store hours/minutes instead of converting to days
      if (isShortDayLeaveType) {
        // Keep days as 0 for shortday leave types (we'll use hours/minutes instead)
        days = 0;
      } else {
        // For backward compatibility with old shortday requests
        days = calculatedHours > 0 || calculatedMinutes > 0 
          ? (calculatedHours + calculatedMinutes / 60) / 24 
          : 0.25;
      }
    } else {
      days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

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

      // Check balance - handle shortday leave types differently
      if (isShortDayLeaveType) {
        // For shortday leave types, check hours/minutes balance
        let remainingHours = allottedLeave.remainingHours !== undefined ? allottedLeave.remainingHours : (allottedLeave.hours || 0);
        let remainingMinutes = allottedLeave.remainingMinutes !== undefined ? allottedLeave.remainingMinutes : (allottedLeave.minutes || 0);
        
        // Get all approved requests for this leave type
        const approvedRequests = await Leave.find({
          userId: userIdObj,
          leaveType: leaveTypeId,
          allottedBy: { $exists: false },
          status: 'approved',
        }).lean();

        // Calculate total used hours and minutes
        let totalUsedMinutes = 0;
        approvedRequests.forEach((req: any) => {
          const reqHours = req.hours || 0;
          const reqMinutes = req.minutes || 0;
          totalUsedMinutes += reqHours * 60 + reqMinutes;
        });
        
        // Add current request minutes
        const requestedMinutes = calculatedHours * 60 + calculatedMinutes;
        totalUsedMinutes += requestedMinutes;
        
        // Calculate remaining
        const totalAllottedMinutes = (allottedLeave.hours || 0) * 60 + (allottedLeave.minutes || 0);
        const actualRemainingMinutes = Math.max(0, totalAllottedMinutes - (totalUsedMinutes - requestedMinutes));
        
        // Check if balance is sufficient
        if (actualRemainingMinutes < requestedMinutes) {
          const remainingH = Math.floor(actualRemainingMinutes / 60);
          const remainingM = actualRemainingMinutes % 60;
          const requestedH = calculatedHours;
          const requestedM = calculatedMinutes;
          return NextResponse.json(
            { error: `Insufficient leave balance. You have ${remainingH}h${remainingM > 0 ? ` ${remainingM}m` : ''} remaining, but requested ${requestedH}h${requestedM > 0 ? ` ${requestedM}m` : ''}.` },
            { status: 400 }
          );
        }
      } else {
        // For regular leave types, check days balance
        let remainingDays = allottedLeave.remainingDays;
        if (remainingDays === undefined || remainingDays === null) {
          remainingDays = allottedLeave.days || 0;
        }

        // Get all approved requests for this leave type
        const approvedRequests = await Leave.find({
          userId: userIdObj,
          leaveType: leaveTypeId,
          allottedBy: { $exists: false },
          status: 'approved',
        }).lean();

        // Calculate total used days
        const totalUsed = approvedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
        
        // Calculate actual remaining days
        const actualRemainingDays = Math.max(0, (allottedLeave.days || 0) - totalUsed);

        // Check if balance is sufficient
        if (actualRemainingDays < days) {
          // Format decimal days for display
          const remainingDisplay = actualRemainingDays % 1 === 0 
            ? actualRemainingDays.toString() 
            : actualRemainingDays.toFixed(2);
          const requestedDisplay = days % 1 === 0 
            ? days.toString() 
            : days.toFixed(2);
          return NextResponse.json(
            { error: `Insufficient leave balance. You have ${remainingDisplay} days remaining, but requested ${requestedDisplay} days.` },
            { status: 400 }
          );
        }
      }
    }

    const leaveData: any = {
      userId,
      leaveType: leaveTypeId,
      days,
      startDate: start,
      endDate: end,
      reason,
      status: 'pending', // Always pending - requires admin/HR approval
      ...(isHalfDay && { halfDayType }), // Include halfDayType if it's a half-day leave
      ...(isShortDay && finalShortDayTime && { shortDayTime: finalShortDayTime }), // Include shortDayTime if it's a short-day leave
      ...(medicalReport && { medicalReport }), // Include medicalReport if provided
    };
    
    // Log medical report for debugging
    if (medicalReport) {
      console.log('[Leave API] Medical report received:', medicalReport);
    }
    
    // For shortday leave types, store hours and minutes
    if (isShortDayLeaveType && isShortDay) {
      leaveData.hours = calculatedHours;
      leaveData.minutes = calculatedMinutes;
    }
    
    const leave = new Leave(leaveData);

    await leave.save();
    
    // Log saved medical report for debugging
    if (leave.medicalReport) {
      console.log('[Leave API] Medical report saved successfully:', leave.medicalReport);
    }
    await leave.populate('userId', 'name email profileImage');
    await leave.populate('leaveType', 'name description');

    // Send email notification to Admin and HR when employee applies for leave
    const userRole = (session.user as any).role;
    if (userRole === 'employee') {
      try {
        // Get all Admin and HR users (both can approve leave requests)
        const adminAndHRUsers = await User.find({
          role: { $in: ['admin', 'hr'] },
          emailVerified: true,
        }).select('_id email').lean();

        const adminAndHREmails = adminAndHRUsers.map((user: any) => user.email).filter(Boolean);
        const adminAndHRIds = adminAndHRUsers.map((user: any) => user._id.toString()).filter(Boolean);

        if (adminAndHREmails.length > 0) {
          const user = typeof leave.userId === 'object' && leave.userId && 'email' in leave.userId ? leave.userId as any : null;
          const leaveType = typeof leave.leaveType === 'object' && leave.leaveType && 'name' in leave.leaveType ? leave.leaveType as any : null;

          if (user && leaveType) {
            // Check if this is a shortday leave type
            const leaveTypeName = (leaveType.name as string)?.toLowerCase() || '';
            const isShortDayLeaveType = leaveTypeName.includes('shortday') || 
                                       leaveTypeName.includes('short-day') || 
                                       leaveTypeName.includes('short day');
            
            await sendLeaveRequestNotificationToHR(adminAndHREmails, {
              employeeName: (user.name as string) || 'Employee',
              employeeEmail: (user.email as string) || '',
              profileImage: user.profileImage as string | undefined,
              leaveType: (leaveType.name as string) || 'Leave',
              reason: leave.reason || '',
              days: leave.days || 0,
              startDate: format(new Date(leave.startDate), 'MMM dd, yyyy'),
              endDate: format(new Date(leave.endDate), 'MMM dd, yyyy'),
              halfDayType: (leave as any).halfDayType, // Include half-day type if present
              shortDayTime: (leave as any).shortDayTime, // Include short-day time if present
              hours: isShortDayLeaveType ? ((leave as any).hours || 0) : undefined, // Include hours for shortday leaves
              minutes: isShortDayLeaveType ? ((leave as any).minutes || 0) : undefined, // Include minutes for shortday leaves
            });

            // Send push notifications to all admin and HR users
            try {
              const { sendPushNotificationToUsers } = await import('@/lib/pushNotificationManager');
              const employeeName = (user.name as string) || 'An employee';
              const daysText = leave.days === 0.5 
                ? '0.5-day' 
                : leave.days < 1 
                ? `${leave.days.toFixed(2)}-day` 
                : `${leave.days}-day`;
              const startDate = format(new Date(leave.startDate), 'MMM dd, yyyy');
              const endDate = format(new Date(leave.endDate), 'MMM dd, yyyy');
              const dateText = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
              
              await sendPushNotificationToUsers(adminAndHRIds, {
                title: 'New Leave Request',
                body: `${employeeName} requested ${daysText} leave for ${dateText}`,
                icon: '/assets/maverixicon.png',
                badge: '/assets/maverixicon.png',
                tag: `leave-request-${leave._id}`,
                data: {
                  leaveId: (leave._id as mongoose.Types.ObjectId).toString(),
                  type: 'leave_request',
                  url: '/hr/leave-request',
                },
              });
            } catch (pushError) {
              // Log but don't fail - push notifications are non-critical
              console.error('Error sending push notification for leave request:', pushError);
            }
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

