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

    const { userId, leaveType, days, carryForward, reason } = await request.json();
    const allottedBy = (session.user as any).id;

    if (!userId || !leaveType || !days) {
      return NextResponse.json(
        { error: 'Employee, leave type, and days are required' },
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

    // Calculate start and end dates based on days
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + parseInt(days) - 1);

    // Convert allottedBy to ObjectId (userIdObj already created above)
    const allottedByObj = new mongoose.Types.ObjectId(allottedBy);

    const daysValue = parseInt(days);
    const leave = new Leave({
      userId: userIdObj,
      leaveType: leaveTypeId,
      days: daysValue,
      remainingDays: daysValue, // Initialize remaining days equal to allotted days
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

