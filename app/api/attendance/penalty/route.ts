import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Penalty from '@/models/Penalty';
import Attendance from '@/models/Attendance';
import Settings from '@/models/Settings';
import User from '@/models/User';
import Leave from '@/models/Leave';
import LeaveType from '@/models/LeaveType';
import mongoose from 'mongoose';
import { checkAndCreatePenalty } from '@/lib/penaltyUtils';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get('userId') || (session.user as any).id;
    const dateParam = request.nextUrl.searchParams.get('date');

    await connectDB();

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get max late days from settings FIRST (to validate existing penalties)
    const maxLateDaysSetting = await Settings.findOne({ key: 'maxLateDays' });
    const maxLateDays = maxLateDaysSetting?.value !== undefined ? maxLateDaysSetting.value : 0;

    // Check if user has penalty today
    const penalty = await Penalty.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      date: { $gte: targetDate, $lte: endOfDay },
    }).lean();

    if (!penalty) {
      return NextResponse.json({ hasPenalty: false });
    }

    // Validate penalty: Only show penalty if it's still valid based on current maxLateDays
    // If maxLateDays was increased after penalty was created, the penalty might be invalid
    // A penalty is valid if: maxLateDays is 0 (immediate penalty) OR lateArrivalCount > maxLateDays
    const penaltyLateCount = penalty.lateArrivalCount || 0;
    const isPenaltyValid = maxLateDays === 0 
      ? penaltyLateCount > 0 
      : penaltyLateCount > maxLateDays;

    if (!isPenaltyValid) {
      // Penalty exists but is no longer valid (maxLateDays was increased)
      // Delete the invalid penalty from database
      try {
        await Penalty.deleteOne({ _id: penalty._id });
      } catch (deleteError: any) {
        console.error(`[Penalty API] Error deleting invalid penalty:`, deleteError);
      }
      // Return as if no penalty exists
      return NextResponse.json({ hasPenalty: false });
    }

    // Get user's time limit (custom or default)
    const user = await User.findById(userId).lean();
    let timeLimit = '';
    
    if (user?.clockInTime && user.clockInTime !== 'N/R') {
      timeLimit = user.clockInTime;
    } else {
      const defaultTimeSetting = await Settings.findOne({ key: 'defaultClockInTimeLimit' });
      timeLimit = defaultTimeSetting?.value || '';
    }

    if (!timeLimit) {
      timeLimit = penalty.timeLimit || '';
    }

    // Get all late arrivals for current month from attendance records
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [limitHours, limitMinutes] = timeLimit.split(':').map(Number);
    const limitTotalMinutes = limitHours * 60 + limitMinutes;

    const attendanceRecords = await Attendance.find({
      userId: new mongoose.Types.ObjectId(userId),
      clockIn: { $gte: startOfMonth },
    })
      .select('clockIn date')
      .sort({ clockIn: 1 })
      .lean();

    // Count late arrivals with their dates and times
    const lateArrivals: Array<{ date: string; clockInTime: string }> = [];
    const lateArrivalDays = new Set<string>();

    for (const record of attendanceRecords) {
      if (record.clockIn) {
        const recordDate = new Date(record.clockIn);
        const recordHours = recordDate.getHours();
        const recordMinutes = recordDate.getMinutes();
        const recordTotalMinutes = recordHours * 60 + recordMinutes;

        if (recordTotalMinutes > limitTotalMinutes) {
          const dateStr = recordDate.toISOString().split('T')[0];
          if (!lateArrivalDays.has(dateStr)) {
            lateArrivalDays.add(dateStr);
            lateArrivals.push({
              date: dateStr,
              clockInTime: `${String(recordHours).padStart(2, '0')}:${String(recordMinutes).padStart(2, '0')}`,
            });
          }
        }
      }
    }

    // Get the penalty date (when penalty was created)
    const penaltyDate = penalty.date ? format(new Date(penalty.date), 'yyyy-MM-dd') : null;
    const lateArrivalDate = penalty.lateArrivalDate ? format(new Date(penalty.lateArrivalDate), 'yyyy-MM-dd') : null;

    // Get casual leave information
    let totalCasualLeave = 0;
    let deductedCasualLeave = 0;
    let updatedCasualLeave = 0;

    try {
      // Find or get casual leave type
      const casualLeaveType = await LeaveType.findOne({ 
        name: { $regex: /^casual\s*leave$/i } 
      });

      if (casualLeaveType) {
        // Get allotted casual leave
        const allottedLeave = await Leave.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          leaveType: casualLeaveType._id,
          allottedBy: { $exists: true, $ne: null },
        }).lean();

        if (allottedLeave) {
          totalCasualLeave = allottedLeave.days || 0;
          
          // Calculate total deducted due to penalties
          const penaltyLeaves = await Leave.find({
            userId: new mongoose.Types.ObjectId(userId),
            leaveType: casualLeaveType._id,
            status: 'approved',
            allottedBy: { $exists: false },
            reason: { $regex: /penalty|late.*clock.*in|exceeded.*max.*late/i },
          }).lean();

          deductedCasualLeave = penaltyLeaves.reduce((sum: number, leave: any) => sum + (leave.days || 0), 0);

          // Calculate remaining days (total - all approved requests including penalties)
          const allApprovedRequests = await Leave.find({
            userId: new mongoose.Types.ObjectId(userId),
            leaveType: casualLeaveType._id,
            status: 'approved',
            allottedBy: { $exists: false },
          }).lean();

          const totalUsed = allApprovedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
          updatedCasualLeave = Math.max(0, totalCasualLeave - totalUsed);
        }
      }
    } catch (leaveError: any) {
      console.error('[Penalty API] Error fetching casual leave info:', leaveError);
    }

    return NextResponse.json({
      hasPenalty: true,
      penaltyDetails: {
        penaltyAmount: penalty.penaltyAmount || 0.5,
        maxLateDays: maxLateDays, // Always use current setting, not the stored value
        lateArrivalCount: penalty.lateArrivalCount || lateArrivals.length,
        lateArrivals: lateArrivals,
        timeLimit: timeLimit,
        penaltyDate: penaltyDate, // Date when penalty was created
        lateArrivalDate: lateArrivalDate, // Date when user was late that triggered penalty
        casualLeave: {
          total: totalCasualLeave,
          deducted: deductedCasualLeave,
          remaining: updatedCasualLeave,
        },
      },
    });
  } catch (error: any) {
    console.error('Get penalty error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { userId, clockInTime } = await request.json();

    if (!userId || !clockInTime) {
      return NextResponse.json(
        { error: 'User ID and clock-in time are required' },
        { status: 400 }
      );
    }

    const clockInDate = new Date(clockInTime);
    if (isNaN(clockInDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid clock-in time format' },
        { status: 400 }
      );
    }

    // Use the shared penalty utility to check all conditions and create penalty
    const result = await checkAndCreatePenalty(userId, clockInDate);

    return NextResponse.json({
      shouldCreatePenalty: result.shouldCreatePenalty,
      message: result.message,
      penaltyId: result.penaltyId,
      lateArrivalCount: result.lateArrivalCount,
      maxLateDays: result.maxLateDays,
    });
  } catch (error: any) {
    console.error('Create penalty error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

