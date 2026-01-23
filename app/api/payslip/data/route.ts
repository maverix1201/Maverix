import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Finance from '@/models/Finance';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay } from 'date-fns';

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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = parseInt(searchParams.get('month') || '0');
    const year = parseInt(searchParams.get('year') || '0');

    if (!userId || !month || !year) {
      return NextResponse.json(
        { error: 'userId, month, and year are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get employee data
    const employee = await User.findById(userId).lean();
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get finance data for the month
    const finance = await Finance.findOne({
      userId,
      month,
      year,
    }).lean();

    // Calculate work days
    const monthStart = startOfMonth(new Date(year, month - 1, 1));
    const monthEnd = endOfMonth(new Date(year, month - 1, 1));
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Get weekly off days
    const weeklyOff = (employee.weeklyOff as string[]) || [];
    
    // Get attendance records for the month
    const attendanceRecords = await Attendance.find({
      userId,
      date: {
        $gte: monthStart,
        $lte: monthEnd,
      },
      status: 'present',
    }).lean();

    // Get leave records for the month
    const leaveRecords = await Leave.find({
      userId,
      status: 'approved',
      $or: [
        {
          startDate: { $lte: monthEnd },
          endDate: { $gte: monthStart },
        },
      ],
    }).lean();

    // Calculate effective work days
    let effectiveWorkDays = 0;
    let lopDays = 0; // Loss of Pay days

    allDays.forEach((day) => {
      const dayName = format(day, 'EEEE');
      const isWeeklyOff = weeklyOff.includes(dayName);
      
      if (!isWeeklyOff) {
        // Check if present
        const isPresent = attendanceRecords.some((record) => {
          const recordDate = new Date(record.date);
          return isSameDay(recordDate, day);
        });

        // Check if on leave
        const isOnLeave = leaveRecords.some((leave) => {
          const startDate = new Date(leave.startDate);
          const endDate = new Date(leave.endDate);
          return day >= startDate && day <= endDate;
        });

        if (isPresent) {
          effectiveWorkDays++;
        } else if (!isOnLeave) {
          // Not present and not on leave = LOP
          lopDays++;
        }
      }
    });

    const totalDaysInMonth = allDays.length;

    // Get joining year from employee profile
    const dateOfJoining = employee.joiningYear 
      ? employee.joiningYear.toString()
      : 'N/A';

    return NextResponse.json({
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        empId: employee.empId,
        designation: employee.designation,
        dateOfJoining: dateOfJoining,
        bankName: employee.bankName,
        accountNumber: employee.accountNumber,
        ifscCode: employee.ifscCode,
        panCardImage: employee.panCardImage,
        aadharCardImage: employee.aadharCardImage,
        location: employee.location,
        panNumber: employee.panNumber,
        aadharNumber: employee.aadharNumber,
      },
      finance: finance || null,
      workDays: {
        effective: effectiveWorkDays,
        total: totalDaysInMonth,
        lop: lopDays,
      },
    });
  } catch (error: any) {
    console.error('Get payslip data error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
