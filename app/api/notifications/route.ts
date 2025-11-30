import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Notification from '@/models/Notification';

export const dynamic = 'force-dynamic';

// GET - Get all notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    await connectDB();

    const notifications = await Notification.find({
      userId,
      dismissed: false,
    })
      .sort({ createdAt: -1 })
      .populate('leaveId', 'startDate endDate days leaveType reason status')
      .lean();

    return NextResponse.json({ notifications });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// POST - Create a notification (admin/hr only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'admin' && userRole !== 'hr') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, type, title, message, leaveId } = await request.json();

    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { error: 'userId, type, title, and message are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const notification = new Notification({
      userId,
      type,
      title,
      message,
      leaveId: leaveId || undefined,
      dismissed: false,
    });

    await notification.save();

    return NextResponse.json({
      message: 'Notification created successfully',
      notification,
    });
  } catch (error: any) {
    console.error('Create notification error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

