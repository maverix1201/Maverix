import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ScheduledEmail from '@/models/ScheduledEmail';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// This endpoint tracks email opens via a tracking pixel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get('emailId');
    const userId = searchParams.get('userId');

    if (!emailId || !userId) {
      // Return a 1x1 transparent pixel even if params are missing
      return new NextResponse(
        Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
        {
          status: 200,
          headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    await connectDB();

    // Convert userId to ObjectId
    const userIdObjectId = new mongoose.Types.ObjectId(userId);

    // Update the email to track that this user opened it
    const result = await ScheduledEmail.findByIdAndUpdate(
      emailId,
      {
        $addToSet: { openedBy: userIdObjectId }, // Add userId to openedBy array if not already present
      },
      { new: true }
    );

    console.log(`Email ${emailId} opened by user ${userId}. OpenedBy count: ${result?.openedBy?.length || 0}`);

    // Return a 1x1 transparent GIF pixel
    return new NextResponse(
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
      {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Error tracking email open:', error);
    // Still return a pixel even on error to avoid breaking email display
    return new NextResponse(
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
      {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

