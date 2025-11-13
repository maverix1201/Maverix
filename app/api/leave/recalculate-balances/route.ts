import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

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

    await connectDB();

    // Get all allotted leaves
    const allottedLeaves = await Leave.find({
      allottedBy: { $exists: true, $ne: null },
    });

    let updated = 0;

    for (const allottedLeave of allottedLeaves) {
      // Initialize remainingDays if not set
      if (allottedLeave.remainingDays === undefined || allottedLeave.remainingDays === null) {
        allottedLeave.remainingDays = allottedLeave.days || 0;
      }

      // Find all approved leave requests for this leave type and user
      const approvedRequests = await Leave.find({
        userId: allottedLeave.userId,
        leaveType: allottedLeave.leaveType,
        status: 'approved',
        allottedBy: { $exists: false },
      });

      // Calculate total used days
      const totalUsed = approvedRequests.reduce((sum, req) => sum + (req.days || 0), 0);

      // Recalculate remaining days
      const totalDays = allottedLeave.days || 0;
      allottedLeave.remainingDays = Math.max(0, totalDays - totalUsed);

      await allottedLeave.save();
      updated++;
    }

    return NextResponse.json({
      message: `Recalculated balances for ${updated} allotted leaves`,
      updated,
    });
  } catch (error: any) {
    console.error('Recalculate balances error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}


