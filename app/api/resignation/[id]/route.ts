import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Resignation from '@/models/Resignation';

export const dynamic = 'force-dynamic';

// PUT - Update resignation status (approve/reject)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    const userId = (session.user as any)?.id;

    // Only admin and HR can approve/reject resignations
    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json(
        { error: 'Only admin and HR can manage resignations' },
        { status: 403 }
      );
    }

    const { status, rejectionReason } = await request.json();

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status (approved/rejected) is required' },
        { status: 400 }
      );
    }

    if (status === 'rejected' && !rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required when rejecting a resignation' },
        { status: 400 }
      );
    }

    await connectDB();

    const resignation = await Resignation.findById(params.id);

    if (!resignation) {
      return NextResponse.json({ error: 'Resignation not found' }, { status: 404 });
    }

    if (resignation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Resignation has already been processed' },
        { status: 400 }
      );
    }

    resignation.status = status;
    resignation.approvedBy = userId;
    resignation.approvedAt = new Date();

    if (status === 'rejected') {
      resignation.rejectionReason = rejectionReason;
    }

    // When approving, automatically mark initial steps as in-progress if they have data
    if (status === 'approved') {
      // If notice period dates are provided, mark notice period as in-progress
      if (resignation.noticePeriodStartDate && resignation.noticePeriodEndDate) {
        // Notice period compliance will be checked later, but we can mark it as in-progress
        // Don't auto-complete it, as it needs to be verified
      }
      
      // If handover notes exist, mark knowledge transfer as in-progress
      if (resignation.handoverNotes && resignation.handoverNotes.trim() !== '') {
        // Knowledge transfer is in-progress if notes exist but not completed yet
        // Don't auto-complete it
      }
      
      // Clearances are initialized as pending, which is correct
      // They need to be approved by individual departments
    }

    await resignation.save();
    await resignation.populate('userId', 'name email profileImage empId designation');
    await resignation.populate('approvedBy', 'name email');

    // TODO: Send email notification to employee

    return NextResponse.json(
      { message: `Resignation ${status} successfully`, resignation },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating resignation:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// DELETE - Delete resignation (only by employee who submitted it, and only if pending)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    const userId = (session.user as any)?.id;

    await connectDB();

    const resignation = await Resignation.findById(params.id);

    if (!resignation) {
      return NextResponse.json({ error: 'Resignation not found' }, { status: 404 });
    }

    // Only employees can delete their own pending resignations
    if (role === 'employee') {
      if (resignation.userId.toString() !== userId) {
        return NextResponse.json(
          { error: 'You can only delete your own resignations' },
          { status: 403 }
        );
      }

      if (resignation.status !== 'pending') {
        return NextResponse.json(
          { error: 'You can only delete pending resignations' },
          { status: 400 }
        );
      }
    } else if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json(
        { error: 'Unauthorized to delete resignations' },
        { status: 403 }
      );
    }

    await Resignation.findByIdAndDelete(params.id);

    return NextResponse.json(
      { message: 'Resignation deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting resignation:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
