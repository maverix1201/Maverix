import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    await connectDB();

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Find teams where user is either a leader or a member
    const teams = await Team.find({
      $or: [
        { leader: userObjectId },
        { members: userObjectId },
      ],
    })
      .populate('leader', 'name email profileImage')
      .populate('members', 'name email profileImage')
      .lean();

    if (teams.length === 0) {
      return NextResponse.json({ teamMembersOnLeave: [] });
    }

    // Get all team member IDs (leader + members) from all teams
    const teamMemberIds: mongoose.Types.ObjectId[] = [];
    teams.forEach((team: any) => {
      if (team.leader && team.leader._id.toString() !== userId) {
        teamMemberIds.push(new mongoose.Types.ObjectId(team.leader._id));
      }
      if (team.members && Array.isArray(team.members)) {
        team.members.forEach((member: any) => {
          const memberId = typeof member === 'object' && member._id 
            ? member._id.toString() 
            : member.toString();
          if (memberId !== userId) {
            teamMemberIds.push(new mongoose.Types.ObjectId(memberId));
          }
        });
      }
    });

    if (teamMemberIds.length === 0) {
      return NextResponse.json({ teamMembersOnLeave: [] });
    }

    // Find leaves that overlap with the requested date range
    // A leave overlaps if: (leave.startDate <= end) AND (leave.endDate >= start)
    const overlappingLeaves = await Leave.find({
      userId: { $in: teamMemberIds },
      status: { $in: ['pending', 'approved'] },
      // Leave starts before or on the end date and ends on or after the start date
      startDate: { $lte: end },
      endDate: { $gte: start },
    })
      .populate('userId', 'name email profileImage')
      .populate('leaveType', 'name')
      .lean();

    // Group by user and format the response
    const membersOnLeaveMap = new Map();
    
    overlappingLeaves.forEach((leave: any) => {
      const userId = typeof leave.userId === 'object' && leave.userId?._id 
        ? leave.userId._id.toString() 
        : leave.userId.toString();
      
      if (!membersOnLeaveMap.has(userId)) {
        const user = typeof leave.userId === 'object' ? leave.userId : null;
        membersOnLeaveMap.set(userId, {
          _id: userId,
          name: user?.name || 'Unknown',
          email: user?.email || '',
          profileImage: user?.profileImage,
          leaves: [],
        });
      }

      const memberData = membersOnLeaveMap.get(userId);
      memberData.leaves.push({
        leaveType: typeof leave.leaveType === 'object' ? leave.leaveType?.name : leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        status: leave.status,
      });
    });

    const teamMembersOnLeave = Array.from(membersOnLeaveMap.values());

    return NextResponse.json({ 
      teamMembersOnLeave,
      count: teamMembersOnLeave.length 
    });
  } catch (error: any) {
    console.error('Get team members on leave error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

