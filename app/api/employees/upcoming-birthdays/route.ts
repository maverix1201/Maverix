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

    await connectDB();

    // Get all employees with dateOfBirth
    const employees = await User.find({
      role: 'employee',
      dateOfBirth: { $exists: true, $ne: null },
    })
      .select('_id name email profileImage dateOfBirth')
      .lean();

    const today = new Date();
    const currentYear = today.getFullYear();

    // Calculate upcoming birthdays (next 10, regardless of month)
    const upcomingBirthdays = employees
      .map((employee: any) => {
        if (!employee.dateOfBirth) return null;

        const dob = new Date(employee.dateOfBirth);
        const birthMonth = dob.getMonth();
        const birthDay = dob.getDate();

        // Calculate next birthday
        let nextBirthday = new Date(currentYear, birthMonth, birthDay);
        if (nextBirthday < today) {
          // Birthday already passed this year, use next year
          nextBirthday = new Date(currentYear + 1, birthMonth, birthDay);
        }

        const daysUntil = Math.ceil(
          (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          _id: employee._id,
          name: employee.name,
          email: employee.email,
          profileImage: employee.profileImage,
          dateOfBirth: employee.dateOfBirth.toISOString().split('T')[0],
          daysUntil,
        };
      })
      .filter((item: any) => item !== null)
      .sort((a: any, b: any) => a.daysUntil - b.daysUntil)
      .slice(0, 10); // Limit to 10 upcoming birthdays (regardless of month)

    return NextResponse.json({ birthdays: upcomingBirthdays });
  } catch (error: any) {
    console.error('Get upcoming birthdays error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

