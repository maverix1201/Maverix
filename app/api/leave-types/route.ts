import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import LeaveType from '@/models/LeaveType';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const leaveTypes = await LeaveType.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    const response = NextResponse.json({ leaveTypes });
    // Leave types change rarely - cache for 1 hour with revalidation
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return response;
  } catch (error: any) {
    console.error('Get leave types error:', error);
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, maxDays } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Leave type name is required' }, { status: 400 });
    }

    await connectDB();

    const leaveType = new LeaveType({
      name,
      description,
      maxDays: maxDays ? parseInt(maxDays) : undefined,
      isActive: true,
    });

    await leaveType.save();

    return NextResponse.json({
      message: 'Leave type created successfully',
      leaveType,
    });
  } catch (error: any) {
    console.error('Create leave type error:', error);
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Leave type already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Leave type ID is required' }, { status: 400 });
    }

    await connectDB();

    // Actually delete from database instead of soft delete
    await LeaveType.findByIdAndDelete(id);

    return NextResponse.json({
      message: 'Leave type deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete leave type error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

