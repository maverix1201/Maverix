import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Team from '@/models/Team';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    await connectDB();

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Find teams where user is either a leader or a member
    const teams = await Team.find({
      $or: [
        { leader: userObjectId },
        { members: userObjectId },
      ],
    })
      .populate('leader', 'name email profileImage mobileNumber')
      .populate('members', 'name email profileImage mobileNumber')
      .sort({ createdAt: -1 });

    return NextResponse.json({ teams });
  } catch (error: any) {
    console.error('Get my teams error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

