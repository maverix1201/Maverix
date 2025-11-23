import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Leave from '@/models/Leave';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    // Find all approved leaves that include today
    // A leave includes today if: startDate <= today AND endDate >= today
    // CRITICAL: Only include leaves with status exactly 'approved' (exclude 'pending' and 'rejected')
    const leavesOnLeaveToday = await Leave.find({
      status: 'approved', // Only approved status
      startDate: { $lte: endOfToday },
      endDate: { $gte: today },
    })
      .select('userId status startDate endDate') // Include fields for verification
      .lean();

    // Triple-check: filter out any non-approved leaves and verify dates
    const approvedLeavesOnly = leavesOnLeaveToday.filter((leave: any) => {
      // Ensure status is exactly 'approved' (string comparison)
      if (leave.status !== 'approved') {
        return false;
      }
      
      // Verify dates are valid and include today
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      return startDate <= endOfToday && endDate >= today;
    });

    // Extract unique user IDs from approved leaves only
    const userIdsOnLeave = Array.from(
      new Set(approvedLeavesOnly.map((leave: any) => leave.userId.toString()))
    );

    return NextResponse.json({ 
      userIdsOnLeave,
      count: userIdsOnLeave.length 
    });
  } catch (error: any) {
    console.error('Get on leave today error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

