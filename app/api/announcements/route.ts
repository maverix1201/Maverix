import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Announcement from '@/models/Announcement';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

// GET - Get all announcements (for employees, filtered by view count)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    // Get all announcements, sorted by newest first
    const announcements = await Announcement.find()
      .populate('createdBy', 'name email profileImage role')
      .sort({ createdAt: -1 })
      .lean();

    // For employees, filter announcements that haven't been viewed 2 times yet and date is today or past
    if (userRole === 'employee') {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      const filteredAnnouncements = announcements.filter((announcement: any) => {
        // Check if announcement date is today or in the past
        const announcementDate = new Date(announcement.date);
        announcementDate.setHours(0, 0, 0, 0);
        
        if (announcementDate > today) {
          return false; // Don't show future announcements
        }
        
        // Check view count
        const viewRecord = announcement.views?.find(
          (v: any) => v.userId?.toString() === userId
        );
        const viewCount = viewRecord?.viewCount || 0;
        return viewCount < 2;
      });

      return NextResponse.json({ announcements: filteredAnnouncements });
    }

    // For admin/hr, return all announcements
    return NextResponse.json({ announcements });
  } catch (error: any) {
    console.error('Get announcements error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// POST - Create a new announcement (admin/hr only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    // Only admin and hr can create announcements
    if (userRole !== 'admin' && userRole !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, content, date } = await request.json();

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be less than 200 characters' },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'Content must be less than 5000 characters' },
        { status: 400 }
      );
    }

    await connectDB();

    const userId = (session.user as any).id;

    const announcement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      date: new Date(date),
      createdBy: userId,
    });

    await announcement.save();
    await announcement.populate('createdBy', 'name email profileImage role');

    return NextResponse.json({
      message: 'Announcement created successfully',
      announcement,
    });
  } catch (error: any) {
    console.error('Create announcement error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

