import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Announcement from '@/models/Announcement';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// PUT - Update an announcement (admin/hr only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    // Only admin and hr can update announcements
    if (userRole !== 'admin' && userRole !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const announcementId = params.id;
    const userId = (session.user as any).id;

    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      return NextResponse.json({ error: 'Invalid announcement ID' }, { status: 400 });
    }

    const { title, content, date } = await request.json();

    if (title !== undefined && (!title || !title.trim())) {
      return NextResponse.json(
        { error: 'Title cannot be empty' },
        { status: 400 }
      );
    }

    if (content !== undefined && (!content || !content.trim())) {
      return NextResponse.json(
        { error: 'Content cannot be empty' },
        { status: 400 }
      );
    }

    if (title && title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be less than 200 characters' },
        { status: 400 }
      );
    }

    if (content && content.length > 5000) {
      return NextResponse.json(
        { error: 'Content must be less than 5000 characters' },
        { status: 400 }
      );
    }

    await connectDB();

    const announcement = await Announcement.findById(announcementId);

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Only allow creator or admin/hr to update
    const announcementCreatorId = announcement.createdBy?.toString();
    if (announcementCreatorId !== userId && userRole !== 'admin') {
      return NextResponse.json({ error: 'You can only edit your own announcements' }, { status: 403 });
    }

    // Update fields
    if (title !== undefined) {
      announcement.title = title.trim();
    }

    if (content !== undefined) {
      announcement.content = content.trim();
    }

    if (date !== undefined) {
      announcement.date = new Date(date);
    }

    await announcement.save();
    await announcement.populate('createdBy', 'name email profileImage role');

    return NextResponse.json({
      message: 'Announcement updated successfully',
      announcement,
    });
  } catch (error: any) {
    console.error('Update announcement error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// DELETE - Delete an announcement (admin/hr only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    // Only admin and hr can delete announcements
    if (userRole !== 'admin' && userRole !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const announcementId = params.id;
    const userId = (session.user as any).id;

    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      return NextResponse.json({ error: 'Invalid announcement ID' }, { status: 400 });
    }

    await connectDB();

    const announcement = await Announcement.findById(announcementId);

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Only allow creator or admin to delete
    const announcementCreatorId = announcement.createdBy?.toString();
    if (announcementCreatorId !== userId && userRole !== 'admin') {
      return NextResponse.json({ error: 'You can only delete your own announcements' }, { status: 403 });
    }

    await Announcement.findByIdAndDelete(announcementId);

    return NextResponse.json({
      message: 'Announcement deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete announcement error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

