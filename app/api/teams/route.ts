import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Team from '@/models/Team';
import mongoose from 'mongoose';

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
      .sort({ createdAt: -1 });

    return NextResponse.json({ teams });
  } catch (error: any) {
    console.error('Get teams error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, leader, members } = await request.json();
    const createdBy = (session.user as any).id;

    if (!name || !leader) {
      return NextResponse.json(
        { error: 'Team name and leader are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Convert to ObjectIds
    const leaderId = new mongoose.Types.ObjectId(leader);
    const memberIds = members && Array.isArray(members) 
      ? members.map((id: string) => new mongoose.Types.ObjectId(id))
      : [];

    // Ensure leader is in members array
    const allMembers = [...new Set([String(leaderId), ...memberIds.map((id) => String(id))])]
      .map((id) => new mongoose.Types.ObjectId(id));

    const team = new Team({
      name,
      description,
      leader: leaderId,
      members: allMembers,
      createdBy: new mongoose.Types.ObjectId(createdBy),
    });

    await team.save();
    await team.populate('leader', 'name email profileImage mobileNumber');
    await team.populate('members', 'name email profileImage mobileNumber');
    await team.populate('createdBy', 'name email profileImage');

    return NextResponse.json({
      message: 'Team created successfully',
      team,
    });
  } catch (error: any) {
    console.error('Create team error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

