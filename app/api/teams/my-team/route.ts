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
      .populate('leader', 'name email profileImage mobileNumber designation')
      .populate('members', 'name email profileImage mobileNumber designation')
      .sort({ createdAt: -1 });

    const response = NextResponse.json({ teams });
    // Teams change rarely - cache for 5 minutes
    response.headers.set('Cache-Control', 'private, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error: any) {
    console.error('Get my teams error:', error);
    const errorResponse = NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    errorResponse.headers.set('Cache-Control', 'no-store');
    return errorResponse;
  }
}

