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

    const user = await User.findById((session.user as any).id).select('panCardImage aadharCardImage').lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return documents - handle null, undefined, and empty strings properly
    const panCard = user.panCardImage && typeof user.panCardImage === 'string' && user.panCardImage.trim() !== '' 
      ? user.panCardImage 
      : null;
    const aadharCard = user.aadharCardImage && typeof user.aadharCardImage === 'string' && user.aadharCardImage.trim() !== '' 
      ? user.aadharCardImage 
      : null;

    const response = NextResponse.json({
      panCardImage: panCard,
      aadharCardImage: aadharCard,
    });
    
    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  } catch (error: any) {
    console.error('Get documents error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    const userId = (session.user as any).id;

    await connectDB();

    const { panCardImage, aadharCardImage } = await request.json();

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions: employee can only update their own documents, admin/HR can update any user's documents
    // For now, we'll allow employees to update their own documents
    // If you want to allow admin/HR to update other users' documents, you'd need to pass userId in the request

    // Update documents if provided
    if (panCardImage !== undefined) {
      user.panCardImage = panCardImage || null;
    }
    if (aadharCardImage !== undefined) {
      user.aadharCardImage = aadharCardImage || null;
    }

    await user.save();

    // Reload user to ensure we have the latest data
    const updatedUser = await User.findById(userId).select('panCardImage aadharCardImage').lean();

    // Handle null, undefined, and empty strings properly
    const panCard = updatedUser?.panCardImage && typeof updatedUser.panCardImage === 'string' && updatedUser.panCardImage.trim() !== '' 
      ? updatedUser.panCardImage 
      : null;
    const aadharCard = updatedUser?.aadharCardImage && typeof updatedUser.aadharCardImage === 'string' && updatedUser.aadharCardImage.trim() !== '' 
      ? updatedUser.aadharCardImage 
      : null;

    const response = NextResponse.json({
      message: 'Documents updated successfully',
      panCardImage: panCard,
      aadharCardImage: aadharCard,
    });
    
    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  } catch (error: any) {
    console.error('Update documents error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
