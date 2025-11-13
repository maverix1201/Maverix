import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ employees: [] });
    }

    await connectDB();

    const searchRegex = new RegExp(query, 'i');

    const employees = await User.find({
      role: 'employee',
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { mobileNumber: searchRegex },
      ],
    })
      .select('_id name email mobileNumber profileImage role')
      .limit(20)
      .lean();

    return NextResponse.json({ employees });
  } catch (error: any) {
    console.error('Search employees error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

