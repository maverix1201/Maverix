import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';

export const dynamic = 'force-dynamic';

interface Activity {
  type: 'clockIn' | 'clockOut' | 'leaveRequest';
  id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profileImage?: string;
  };
  timestamp: Date;
  details: {
    date?: string;
    leaveType?: string;
    status?: string;
  };
}

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

    // Fetch recent clock ins (last 24 hours)
    const recentClockIns = await Attendance.find({
      clockIn: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
      .populate('userId', 'name email profileImage')
      .sort({ clockIn: -1 })
      .limit(10)
      .lean();

    // Fetch recent clock outs (last 24 hours)
    const recentClockOuts = await Attendance.find({
      clockOut: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
      .populate('userId', 'name email profileImage')
      .sort({ clockOut: -1 })
      .limit(10)
      .lean();

    // Fetch recent leave requests (last 7 days)
    const recentLeaveRequests = await Leave.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      allottedBy: { $exists: false }, // Only leave requests, not allotments
    })
      .populate('userId', 'name email profileImage')
      .populate('leaveType', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Combine and format activities
    const activities: Activity[] = [];

    // Add clock in activities
    recentClockIns.forEach((attendance: any) => {
      activities.push({
        type: 'clockIn',
        id: String(attendance._id),
        userId: attendance.userId,
        timestamp: new Date(attendance.clockIn),
        details: {
          date: attendance.date ? new Date(attendance.date).toISOString() : undefined,
        },
      });
    });

    // Add clock out activities
    recentClockOuts.forEach((attendance: any) => {
      activities.push({
        type: 'clockOut',
        id: String(attendance._id) + '_out',
        userId: attendance.userId,
        timestamp: new Date(attendance.clockOut),
        details: {
          date: attendance.date ? new Date(attendance.date).toISOString() : undefined,
        },
      });
    });

    // Add leave request activities
    recentLeaveRequests.forEach((leave: any) => {
      activities.push({
        type: 'leaveRequest',
        id: String(leave._id),
        userId: leave.userId,
        timestamp: new Date(leave.createdAt),
        details: {
          leaveType: leave.leaveType?.name || 'Leave',
          status: leave.status,
        },
      });
    });

    // Sort by timestamp (most recent first) and take top 10
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentActivities = activities.slice(0, 10);

    // Convert timestamps to ISO strings for JSON serialization
    const serializedActivities = recentActivities.map((activity) => ({
      ...activity,
      timestamp: activity.timestamp.toISOString(),
    }));

    return NextResponse.json({ activities: serializedActivities });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

