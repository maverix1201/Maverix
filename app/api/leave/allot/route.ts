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

    const { userId, leaveType, days, hours, minutes, carryForward, reason } = await request.json();
    const allottedBy = (session.user as any).id;

    await connectDB();

    // Verify leave type exists and convert to ObjectId
    const LeaveType = (await import('@/models/LeaveType')).default;
    const leaveTypeId = new mongoose.Types.ObjectId(leaveType);
    const leaveTypeExists = await LeaveType.findById(leaveTypeId);
    if (!leaveTypeExists) {
      return NextResponse.json({ error: 'Invalid leave type' }, { status: 400 });
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
        return NextResponse.json(
          { error: 'Employee, leave type, and hours/minutes are required for shortday leave' },
          { status: 400 }
        );
      }
    } else {
      if (!userId || !leaveType || !days) {
        return NextResponse.json(
          { error: 'Employee, leave type, and days are required' },
          { status: 400 }
        );
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
      return NextResponse.json(
        { error: `Already allotted ${leaveTypeExists.name}` },
        { status: 400 }
      );
    }

    // Calculate start and end dates
    const startDate = new Date();
    const endDate = new Date();
    
    // Convert allottedBy to ObjectId (userIdObj already created above)
    const allottedByObj = new mongoose.Types.ObjectId(allottedBy);

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
      const daysValue = parseFloat(String(days));
      if (isNaN(daysValue) || daysValue <= 0) {
        return NextResponse.json(
          { error: 'Invalid days value' },
          { status: 400 }
        );
      }
      // For decimal days, calculate end date properly
      const daysToAdd = Math.ceil(daysValue) - 1; // Subtract 1 because start date is included
      endDate.setDate(startDate.getDate() + daysToAdd);
      leaveData.days = daysValue;
      leaveData.remainingDays = daysValue;
    }

    const leave = new Leave(leaveData);

    await leave.save();
    await leave.populate('userId', 'name email profileImage');
    await leave.populate('allottedBy', 'name email profileImage');
    await leave.populate('leaveType', 'name description');

    return NextResponse.json({
      message: 'Leave allotted successfully',
      leave,
    });
  } catch (error: any) {
    console.error('Allot leave error:', error);
    
    // Provide more specific error messages
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors || {}).map((err: any) => err.message);
      return NextResponse.json({ 
        error: `Validation failed: ${errors.join(', ')}` 
      }, { status: 400 });
    }
    
    if (error.message?.includes('enum')) {
      return NextResponse.json({ 
        error: 'Invalid leave type. Please refresh the page and try again.' 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

