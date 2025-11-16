import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById((session.user as any).id).select('-password');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, mobileNumber, dateOfBirth, profileImage, currentPassword, newPassword } = await request.json();

    await connectDB();

    const userId = (session.user as any).id;
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build update object
    const updateFields: any = {};

    // Update name
    if (name) {
      updateFields.name = name;
    }

    // Update mobile number
    if (mobileNumber !== undefined) {
      updateFields.mobileNumber = mobileNumber || null;
    }

    // Update date of birth - always include if provided in request
    if (dateOfBirth !== undefined) {
      if (dateOfBirth && typeof dateOfBirth === 'string' && dateOfBirth.trim() !== '') {
        try {
          // Parse the date string (format: YYYY-MM-DD)
          // Use UTC to avoid timezone shifts
          const [year, month, day] = dateOfBirth.split('-').map(Number);
          const dobDate = new Date(Date.UTC(year, month - 1, day));
          if (!isNaN(dobDate.getTime())) {
            updateFields.dateOfBirth = dobDate;
          } else {
            updateFields.dateOfBirth = null;
          }
        } catch (error) {
          console.error('Error parsing dateOfBirth:', error);
          updateFields.dateOfBirth = null;
        }
      } else {
        // Set to null if empty string or null
        updateFields.dateOfBirth = null;
      }
    }

    // Update profile image
    if (profileImage !== undefined) {
      updateFields.profileImage = profileImage;
    }

    // Update password if provided
    if (currentPassword && newPassword) {
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
      }

      updateFields.password = await bcrypt.hash(newPassword, 10);
    }

    // Ensure we have at least one field to update
    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Update user using findByIdAndUpdate to ensure all fields are saved
    await User.findByIdAndUpdate(
      userId, 
      { $set: updateFields }, 
      { new: true, runValidators: true }
    );

    // Return updated user without password
    const userResponse = await User.findById(userId).select('-password').lean();

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: userResponse,
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

