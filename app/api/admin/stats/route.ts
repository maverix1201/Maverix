import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Leave from '@/models/Leave';
import Finance from '@/models/Finance';
import Attendance from '@/models/Attendance';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const [totalEmployees, pendingLeaves, pendingPayments, todayAttendance] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      Leave.countDocuments({ status: 'pending' }),
      Finance.countDocuments({ status: 'pending' }),
      Attendance.countDocuments({ date: new Date() }),
    ]);

    return NextResponse.json({
      totalEmployees,
      pendingLeaves,
      pendingPayments,
      todayAttendance,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

