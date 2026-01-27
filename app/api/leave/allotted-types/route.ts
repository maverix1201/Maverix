import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
import LeaveType from '@/models/LeaveType';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    // Allow both employees and HR to access their allotted leave types
    if (role !== 'employee' && role !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    // Find all leave types that have been allotted to this employee
    const allottedLeaves = await Leave.find({
      userId: new mongoose.Types.ObjectId(userId),
      allottedBy: { $exists: true, $ne: null },
    })
      .populate('leaveType', 'name description')
      .lean();

    // Extract unique leave types
    const leaveTypeMap = new Map();
    allottedLeaves.forEach((leave: any) => {
      if (leave.leaveType && leave.leaveType._id) {
        const leaveTypeId = String(leave.leaveType._id);
        if (!leaveTypeMap.has(leaveTypeId)) {
          leaveTypeMap.set(leaveTypeId, leave.leaveType);
        }
      }
    });

    const allottedLeaveTypes = Array.from(leaveTypeMap.values());

    const response = NextResponse.json({ leaveTypes: allottedLeaveTypes });
    // User-specific but changes rarely - cache for 5 minutes
    response.headers.set('Cache-Control', 'private, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error: any) {
    console.error('Get allotted leave types error:', error);
    const errorResponse = NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    errorResponse.headers.set('Cache-Control', 'no-store');
    return errorResponse;
  }
}

