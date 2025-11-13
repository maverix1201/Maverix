import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Team from '@/models/Team';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const teams = await Team.find()
      .populate('leader', 'name email profileImage mobileNumber')
      .populate('members', 'name email profileImage mobileNumber')
      .populate('createdBy', 'name email profileImage')
      .sort({ createdAt: -1 })
      .limit(10);

    return NextResponse.json({ teams });
  } catch (error: any) {
    console.error('Get recent teams error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

