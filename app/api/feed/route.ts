import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Feed from '@/models/Feed';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Get all posts, sorted by newest first
    const posts = await Feed.find()
      .populate('userId', 'name email profileImage role designation')
      .populate({
        path: 'mentions',
        select: 'name email profileImage mobileNumber role designation',
        strictPopulate: false,
      })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ posts });
  } catch (error: any) {
    console.error('Get feed error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
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

    // Extract mentions from content (format: @username or @email, can include spaces)
    // Match @ followed by name (can include spaces) or email, until space or end
    const mentionRegex = /@([\w\s]+?)(?=\s|$|@)/g;
    const mentionMatches = content.match(mentionRegex) || [];
    const mentionUserIds: string[] = [];

    // Find users by email or name
    for (const mention of mentionMatches) {
      const mentionText = mention.substring(1).trim(); // Remove @ and trim spaces
      if (!mentionText) continue;

      // Try to find user by exact name match first, then by first name, then by email
      let user = await User.findOne({
        $or: [
          { email: mentionText },
          { name: { $regex: new RegExp(`^${mentionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        ],
      }).select('_id').lean();
      
      // If no exact match, try matching by first name
      if (!user) {
        const firstName = mentionText.split(' ')[0];
        user = await User.findOne({
          name: { $regex: new RegExp(`^${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') },
        }).select('_id').lean();
      }
      
      if (user && user._id && !mentionUserIds.includes(user._id.toString())) {
        mentionUserIds.push(user._id.toString());
      }
    }

    const feed = new Feed({
      userId,
      content: content.trim(),
      mentions: mentionUserIds,
    });

    await feed.save();
    await feed.populate('userId', 'name email profileImage role designation');
    await feed.populate({
      path: 'mentions',
      select: 'name email profileImage mobileNumber role designation',
      strictPopulate: false,
    });

    return NextResponse.json({
      message: 'Post created successfully',
      post: feed,
    });
  } catch (error: any) {
    console.error('Create feed error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

