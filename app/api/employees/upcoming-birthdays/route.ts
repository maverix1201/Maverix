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

    // Get all users (employees, admin, hr) with dateOfBirth
    const employees = await User.find({
      dateOfBirth: { $exists: true, $ne: null },
    })
      .select('_id name email profileImage dateOfBirth role designation')
      .lean();

    const today = new Date();
    // Set time to midnight for accurate day comparison
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    // Check if all birthdays are requested
    const { searchParams } = new URL(request.url);
    const getAllBirthdays = searchParams.get('all') === 'true';

    // Calculate upcoming birthdays
    const upcomingBirthdays = employees
      .map((employee: any) => {
        if (!employee.dateOfBirth) return null;

        const dob = new Date(employee.dateOfBirth);
        const birthMonth = dob.getMonth();
        const birthDay = dob.getDate();

        // Calculate next birthday
        let nextBirthday = new Date(currentYear, birthMonth, birthDay);
        nextBirthday.setHours(0, 0, 0, 0);
        
        if (nextBirthday < today) {
          // Birthday already passed this year, use next year
          nextBirthday = new Date(currentYear + 1, birthMonth, birthDay);
          nextBirthday.setHours(0, 0, 0, 0);
        }

        // Calculate days until birthday (including today)
        const timeDiff = nextBirthday.getTime() - today.getTime();
        const daysUntil = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

        return {
          _id: employee._id,
          name: employee.name,
          email: employee.email,
          profileImage: employee.profileImage,
          dateOfBirth: employee.dateOfBirth.toISOString().split('T')[0],
          designation: employee.designation,
          daysUntil,
        };
      })
      .filter((item: any) => item !== null)
      .sort((a: any, b: any) => {
        // Sort by month first, then by day
        if (getAllBirthdays) {
          const aMonth = new Date(a.dateOfBirth).getMonth();
          const bMonth = new Date(b.dateOfBirth).getMonth();
          const aDay = new Date(a.dateOfBirth).getDate();
          const bDay = new Date(b.dateOfBirth).getDate();
          
          if (aMonth !== bMonth) {
            return aMonth - bMonth;
          }
          return aDay - bDay;
        }
        // For upcoming view, sort by days until
        return a.daysUntil - b.daysUntil;
      });

    // Limit to 10 upcoming birthdays only if not requesting all
    const result = getAllBirthdays ? upcomingBirthdays : upcomingBirthdays.slice(0, 10);

    const response = NextResponse.json({ birthdays: result });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    return response;
  } catch (error: any) {
    console.error('Get upcoming birthdays error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

