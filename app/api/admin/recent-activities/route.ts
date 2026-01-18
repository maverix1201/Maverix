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

    const role = (session.user as any).role;
    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Get current date range (start and end of today)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Fetch clock ins for today
    const recentClockIns = await Attendance.find({
      clockIn: { $gte: startOfToday, $lte: endOfToday },
    })
      .populate('userId', 'name email profileImage')
      .sort({ clockIn: -1 })
      .lean();

    // Fetch clock outs for today
    const recentClockOuts = await Attendance.find({
      clockOut: { $gte: startOfToday, $lte: endOfToday },
    })
      .populate('userId', 'name email profileImage')
      .sort({ clockOut: -1 })
      .lean();

    // Fetch leave requests for today
    const recentLeaveRequests = await Leave.find({
      createdAt: { $gte: startOfToday, $lte: endOfToday },
      allottedBy: { $exists: false }, // Only leave requests, not allotments
    })
      .populate('userId', 'name email profileImage')
      .populate('leaveType', 'name')
      .sort({ createdAt: -1 })
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

    // Sort by timestamp (most recent first) - show all activities for today
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentActivities = activities;

    // Convert timestamps to ISO strings for JSON serialization
    const serializedActivities = recentActivities.map((activity) => ({
      ...activity,
      timestamp: activity.timestamp.toISOString(),
    }));

    const response = NextResponse.json({ activities: serializedActivities });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

