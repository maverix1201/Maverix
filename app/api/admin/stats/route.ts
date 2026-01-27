import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Leave from '@/models/Leave';
import Finance from '@/models/Finance';
import Attendance from '@/models/Attendance';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    const todayDayName = format(today, 'EEEE'); // e.g., "Monday"

    // Get all non-admin users (employees + HR)
    const allEmployees = await User.find({ 
      role: { $ne: 'admin' },
      emailVerified: true,
      password: { $exists: true, $ne: null }
    }).select('_id weeklyOff role').lean();
    
    // Separate counts for employees and HR
    const employeeCount = allEmployees.filter((emp: any) => emp.role === 'employee').length;
    const hrCount = allEmployees.filter((emp: any) => emp.role === 'hr').length;

    // Get employees on leave today - any approved leave that covers today
    // A leave covers today if: startDate <= endOfToday AND endDate >= today
    // Only include actual leave requests (exclude allotted leaves and penalty-related leaves)
    const leavesToday = await Leave.find({
      status: 'approved',
      allottedBy: { $exists: false }, // Exclude allotted leaves - only actual leave requests
      $or: [
        { reason: { $exists: false } }, // No reason field
        { reason: null }, // Reason is null
        { reason: { $not: { $regex: /penalty|late.*clock.*in|exceeded.*max.*late|auto.*deduct/i } } } // Reason doesn't match penalty pattern
      ],
      startDate: { $lte: endOfToday }, // Leave starts on or before end of today
      endDate: { $gte: today }, // Leave ends on or after start of today
    }).select('userId reason').lean();
    
    // Additional client-side filter to ensure penalty leaves are excluded
    const filteredLeaves = leavesToday.filter((leave: any) => {
      if (leave.reason && /penalty|late.*clock.*in|exceeded.*max.*late|auto.*deduct/i.test(leave.reason)) {
        return false;
      }
      return true;
    });

    // Get distinct user IDs who are on leave today
    const userIdsOnLeave = new Set(
      filteredLeaves.map((leave: any) => {
        const userId = typeof leave.userId === 'object' && leave.userId?._id 
          ? leave.userId._id.toString() 
          : leave.userId.toString();
        return userId;
      })
    );
    const onLeaveCount = userIdsOnLeave.size;

    // Count employees with weekly off today
    const weeklyOffCount = allEmployees.filter((emp: any) => {
      const weeklyOff = emp.weeklyOff || [];
      return Array.isArray(weeklyOff) && weeklyOff.includes(todayDayName);
    }).length;

    const [totalEmployees, pendingLeaves, clockedInToday] = await Promise.all([
      allEmployees.length,
      Leave.countDocuments({ status: 'pending' }),
      // Count distinct employees who have clocked in today
      Attendance.distinct('userId', {
        clockIn: { $gte: today, $lte: endOfToday }
      }).then(users => users.length),
    ]);

    const response = NextResponse.json({
      totalEmployees,
      employeeCount,
      hrCount,
      pendingLeaves,
      clockedInToday,
      onLeaveToday: onLeaveCount,
      weeklyOffToday: weeklyOffCount,
    });
    // Stats can tolerate slight staleness - cache for 30 seconds
    response.headers.set('Cache-Control', 'private, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    const errorResponse = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    errorResponse.headers.set('Cache-Control', 'no-store');
    return errorResponse;
  }
}

