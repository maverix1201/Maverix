import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Attendance from '@/models/Attendance';

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
    const dateParam = request.nextUrl.searchParams.get('date');

    let query: any = {};

    if (role === 'employee') {
      query.userId = userId;
    }

    if (dateParam) {
      const date = new Date(dateParam);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: date, $lt: nextDay };
      
      // For date query, return the most recent record without clockOut (active session)
      // or the most recent record if all are clocked out
      const attendance = await Attendance.find(query)
        .populate('userId', 'name email profileImage mobileNumber')
        .sort({ clockIn: -1 })
        .lean();

      if (attendance.length > 0) {
        // Find active session (no clockOut) or return most recent
        const activeSession = attendance.find((att: any) => !att.clockOut);
        return NextResponse.json({ attendance: activeSession || attendance[0] });
      }
      
      return NextResponse.json({ attendance: null });
    }

    const attendance = await Attendance.find(query)
      .populate('userId', 'name email profileImage mobileNumber')
      .sort({ clockIn: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({ attendance });
  } catch (error: any) {
    console.error('Get attendance error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, autoClockOut } = await request.json();
    const userId = (session.user as any).id;

    if (!action || (action !== 'clockIn' && action !== 'clockOut')) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (action === 'clockIn') {
      try {
        // Allow multiple clock ins - always create a new record
        const attendance = new Attendance({
          userId,
          date: today,
          clockIn: new Date(),
          status: 'present',
        });

        await attendance.save();

        return NextResponse.json({
          message: 'Clocked in successfully',
          attendance,
        });
      } catch (saveError: any) {
        // Handle duplicate key error (E11000)
        if (saveError.code === 11000 || saveError.message?.includes('duplicate key')) {
          return NextResponse.json(
            {
              error: 'Database index migration required. Please run: GET /api/attendance/migrate-index',
              code: 'MIGRATION_REQUIRED',
            },
            { status: 500 }
          );
        }
        throw saveError;
      }
    } else {
      // Find the most recent clock in without clock out for today
      const attendance = await Attendance.findOne({
        userId,
        date: today,
        clockOut: { $exists: false },
      })
        .sort({ clockIn: -1 });

      if (!attendance) {
        return NextResponse.json({ error: 'No active clock in found. Please clock in first.' }, { status: 400 });
      }

      // If autoClockOut is true, set clock-out time to exactly 11:11 PM on the same day as clock-in
      let clockOutTime: Date;
      if (autoClockOut) {
        // Set to 11:11 PM on the same date as clock-in
        clockOutTime = new Date(attendance.clockIn);
        clockOutTime.setHours(23, 11, 0, 0); // Set to 11:11 PM
      } else {
        clockOutTime = new Date();
      }

      attendance.clockOut = clockOutTime;

      const hoursWorked =
        (clockOutTime.getTime() - attendance.clockIn.getTime()) / (1000 * 60 * 60);
      attendance.hoursWorked = hoursWorked;

      await attendance.save();

      return NextResponse.json({
        message: 'Clocked out successfully',
        attendance,
      });
    }
  } catch (error: any) {
    console.error('Attendance error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

