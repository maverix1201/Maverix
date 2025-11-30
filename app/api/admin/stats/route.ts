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

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalEmployees, pendingLeaves, pendingPayments, clockedInToday] = await Promise.all([
      // Count only employees who have verified email and set password
      User.countDocuments({ 
        role: { $ne: 'admin' },
        emailVerified: true,
        password: { $exists: true, $ne: null }
      }),
      Leave.countDocuments({ status: 'pending' }),
      Finance.countDocuments({ status: 'pending' }),
      // Count distinct employees who have clocked in today
      Attendance.distinct('userId', {
        clockIn: { $gte: today, $lt: tomorrow }
      }).then(users => users.length),
    ]);

    return NextResponse.json({
      totalEmployees,
      pendingLeaves,
      pendingPayments,
      clockedInToday,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

