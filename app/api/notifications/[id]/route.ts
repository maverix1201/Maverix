import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Notification from '@/models/Notification';

export const dynamic = 'force-dynamic';

// PATCH - Dismiss a notification
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    await connectDB();

    const notification = await Notification.findById(params.id);

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Ensure user can only dismiss their own notifications
    if (notification.userId.toString() !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    notification.dismissed = true;
    notification.dismissedAt = new Date();
    await notification.save();

    return NextResponse.json({
      message: 'Notification dismissed successfully',
      notification,
    });
  } catch (error: any) {
    console.error('Dismiss notification error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

