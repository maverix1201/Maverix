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

    const userId = (session.user as any).id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const attendanceThisMonth = await Attendance.countDocuments({
      userId,
      date: { $gte: startOfMonth },
      status: 'present',
    });

    return NextResponse.json({ attendanceThisMonth });
  } catch (error: any) {
    console.error('Get attendance stats error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

