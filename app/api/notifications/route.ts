import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Notification from '@/models/Notification';
import { createNotification } from '@/lib/notificationManager';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// GET - Get all notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 401 });
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('Invalid userId format:', userId);
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    await connectDB();

    // Get query parameters
    const limit = request.nextUrl.searchParams.get('limit');
    const includeDismissed = request.nextUrl.searchParams.get('includeDismissed') === 'true';
    
    const query: any = { userId: new mongoose.Types.ObjectId(userId) };
    if (!includeDismissed) {
      query.dismissed = false;
    }

    // Always limit to 10 most recent notifications
    const notificationLimit = limit ? Math.min(parseInt(limit), 10) : 10;

    // Build query and populate safely - handle populate errors gracefully
    let notifications: any[] = [];
    try {
      const notificationQuery = Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(notificationLimit);

      // Try to populate optional fields
      try {
        notifications = await notificationQuery
          .populate({
            path: 'leaveId',
            select: 'startDate endDate days leaveType reason status',
            strictPopulate: false, // Don't throw error if leaveId doesn't exist
          })
          .populate({
            path: 'feedId',
            select: 'content createdAt',
            strictPopulate: false,
          })
          .populate({
            path: 'mentionedBy',
            select: 'name email profileImage',
            strictPopulate: false,
          })
          .lean();
      } catch (populateError: any) {
        // If populate fails, try without populate
        console.warn('Populate error, retrying without populate:', populateError?.message || populateError);
        notifications = await Notification.find(query)
          .sort({ createdAt: -1 })
          .limit(notificationLimit)
          .lean();
      }
    } catch (queryError: any) {
      // If query itself fails, return empty array instead of error
      console.error('Notification query error:', queryError?.message || queryError);
      notifications = [];
    }

    const response = NextResponse.json({ notifications });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    return response;
  } catch (error: any) {
    console.error('Get notifications error:', error);
    const errorResponse = NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    return errorResponse;
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

    const notification = await createNotification({
      userId,
      type,
      title,
      message,
      leaveId: leaveId || undefined,
    });

    return NextResponse.json({
      message: 'Notification created successfully',
      notification,
    });
  } catch (error: any) {
    console.error('Create notification error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

