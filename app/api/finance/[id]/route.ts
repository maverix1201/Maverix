import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Finance from '@/models/Finance';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { baseSalary, month, year } = await request.json();

    if (!baseSalary || !month || !year) {
      return NextResponse.json(
        { error: 'Base salary, month, and year are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const finance = await Finance.findById(params.id);

    if (!finance) {
      return NextResponse.json({ error: 'Finance record not found' }, { status: 404 });
    }

    // Update finance record
    finance.baseSalary = parseFloat(baseSalary);
    finance.month = parseInt(month);
    finance.year = parseInt(year);
    finance.totalSalary = parseFloat(baseSalary); // Update total salary to match base salary

    await finance.save();
    await finance.populate('userId', 'name email profileImage bankName accountNumber ifscCode');

    return NextResponse.json({
      message: 'Finance record updated successfully',
      finance,
    });
  } catch (error: any) {
    console.error('Update finance error:', error);
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const finance = await Finance.findById(params.id);

    if (!finance) {
      return NextResponse.json({ error: 'Finance record not found' }, { status: 404 });
    }

    await Finance.findByIdAndDelete(params.id);

    return NextResponse.json({
      message: 'Finance record deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete finance error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

