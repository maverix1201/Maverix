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

    const userId = (session.user as any).id;

    await connectDB();

    // Get start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    // Get end of current week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const attendanceRecords = await Attendance.find({
      userId,
      date: {
        $gte: startOfWeek,
        $lte: endOfWeek,
      },
      clockOut: { $exists: true },
    }).lean();

    const totalHours = attendanceRecords.reduce((sum, record) => {
      return sum + (record.hoursWorked || 0);
    }, 0);

    return NextResponse.json({
      weeklyHours: Math.round(totalHours * 10) / 10, // Round to 1 decimal place
      daysWorked: attendanceRecords.length,
    });
  } catch (error: any) {
    console.error('Get weekly hours error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

