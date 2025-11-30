import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Finance from '@/models/Finance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    let query: any = {};

    if (role === 'employee') {
      query.userId = userId;
    }

    const finances = await Finance.find(query)
      .populate('userId', 'name email profileImage bankName accountNumber ifscCode')
      .sort({ year: -1, month: -1 })
      .lean();

    return NextResponse.json({ finances });
  } catch (error: any) {
    console.error('Get finance error:', error);
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      userId,
      month,
      year,
      baseSalary,
    } = await request.json();

    if (!userId || !month || !year || !baseSalary) {
      return NextResponse.json(
        { error: 'User, month, year, and base salary are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const finance = new Finance({
      userId,
      month: parseInt(month),
      year: parseInt(year),
      baseSalary: parseFloat(baseSalary),
      allowances: 0,
      deductions: 0,
      bonus: 0,
      totalSalary: parseFloat(baseSalary),
      status: 'paid',
    });

    await finance.save();
    await finance.populate('userId', 'name email profileImage bankName accountNumber ifscCode');

    return NextResponse.json({
      message: 'Finance record created successfully',
      finance,
    });
  } catch (error: any) {
    console.error('Create finance error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

