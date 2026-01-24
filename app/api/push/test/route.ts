import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Notification from '@/models/Notification';
import connectDB from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// POST - Create a test notification for the current user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const userId = (session.user as any).id;
    const userName = session.user?.name || 'User';

    // Create a test notification in the database
    // Using 'mention' type as it's a valid enum value
    const notification = await Notification.create({
      userId,
      title: '🔔 Test Notification',
      message: `Hello ${userName}! This is a test notification from MaveriX. Browser notifications are working correctly!`,
      type: 'mention',
      read: false,
      dismissed: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Test notification created successfully',
      notification: {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
      },
    });
  } catch (error: any) {
    console.error('Test notification error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// GET - Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
