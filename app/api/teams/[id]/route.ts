import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Team from '@/models/Team';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const team = await Team.findById(params.id)
      .populate('leader', 'name email profileImage mobileNumber')
      .populate('members', 'name email profileImage mobileNumber')
      .populate('createdBy', 'name email profileImage');

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (error: any) {
    console.error('Get team error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    await connectDB();

    const team = await Team.findById(params.id);

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (name) team.name = name;
    if (description !== undefined) team.description = description;

    if (leader) {
      const leaderId = new mongoose.Types.ObjectId(leader);
      team.leader = leaderId;
      
      // Ensure leader is in members array
      const currentMembers = (team.members || []).map((id) => String(id));
      if (!currentMembers.includes(String(leaderId))) {
        team.members.push(leaderId);
      }
    }

    if (members && Array.isArray(members)) {
      const memberIds = members.map((id: string) => new mongoose.Types.ObjectId(id));
      const leaderId = String(team.leader);
      
      // Ensure leader is always in members
      const allMembers = [...new Set([leaderId, ...memberIds.map((id) => String(id))])]
        .map((id) => new mongoose.Types.ObjectId(id));
      
      team.members = allMembers;
    }

    await team.save();
    await team.populate('leader', 'name email profileImage mobileNumber');
    await team.populate('members', 'name email profileImage mobileNumber');
    await team.populate('createdBy', 'name email profileImage');

    return NextResponse.json({
      message: 'Team updated successfully',
      team,
    });
  } catch (error: any) {
    console.error('Update team error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const team = await Team.findByIdAndDelete(params.id);

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Team deleted successfully' });
  } catch (error: any) {
    console.error('Delete team error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

