import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Announcement from '@/models/Announcement';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// POST - Track a view for an announcement
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    // Only employees can track views
    if (userRole !== 'employee') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const announcementId = id;
    const userId = (session.user as any).id;

    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      return NextResponse.json({ error: 'Invalid announcement ID' }, { status: 400 });
    }

    await connectDB();

    const announcement = await Announcement.findById(announcementId);

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Find existing view record for this user
    const viewIndex = announcement.views.findIndex(
      (v: any) => v.userId?.toString() === userId
    );

    if (viewIndex >= 0) {
      // Update existing view count
      const currentCount = announcement.views[viewIndex].viewCount || 0;
      if (currentCount < 2) {
        announcement.views[viewIndex].viewCount = currentCount + 1;
        await announcement.save();
      }
    } else {
      // Create new view record
      announcement.views.push({
        userId: new mongoose.Types.ObjectId(userId),
        viewCount: 1,
      });
      await announcement.save();
    }

    return NextResponse.json({
      message: 'View tracked successfully',
    });
  } catch (error: any) {
    console.error('Track view error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

