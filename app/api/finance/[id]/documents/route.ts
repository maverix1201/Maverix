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
    const userId = (session.user as any).id;

    await connectDB();

    const finance = await Finance.findById(params.id);

    if (!finance) {
      return NextResponse.json({ error: 'Finance record not found' }, { status: 404 });
    }

    // Check permissions: employee can only update their own documents, admin/HR can update any
    const financeUserId = finance.userId?.toString() || finance.userId?.toString();
    if (role === 'employee' && financeUserId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { panCardImage, aadharCardImage } = await request.json();

    // Update documents if provided
    if (panCardImage !== undefined) {
      finance.panCardImage = panCardImage || null;
    }
    if (aadharCardImage !== undefined) {
      finance.aadharCardImage = aadharCardImage || null;
    }

    await finance.save();
    await finance.populate('userId', 'name email profileImage bankName accountNumber ifscCode location panNumber aadharNumber');

    return NextResponse.json({
      message: 'Documents updated successfully',
      finance,
    });
  } catch (error: any) {
    console.error('Update finance documents error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
