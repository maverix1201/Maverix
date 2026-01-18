import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { generateEmployeeId, shouldGenerateEmployeeId } from '@/utils/generateEmployeeId';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Check if profileImage should be included (via query parameter)
    const { searchParams } = new URL(request.url);
    const includeImage = searchParams.get('includeImage') === 'true';

    // Build select fields - exclude password, conditionally exclude profileImage
    let selectFields = '-password';
    if (!includeImage) {
      // Exclude profileImage by default to prevent slow API responses
      // Large base64 images can be several MB and slow down dashboard loads
      selectFields += ' -profileImage';
    }

    const user = await User.findById((session.user as any).id).select(selectFields);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Convert to plain object and handle large profileImage
    const userObj = user.toObject ? user.toObject() : user;
    console.log('[Profile API GET] User joiningYear from DB:', userObj.joiningYear);
    
    // If profileImage is included and too large, exclude it to prevent issues
    if (includeImage && userObj.profileImage && typeof userObj.profileImage === 'string') {
      // If profileImage is larger than 100KB, exclude it (too large for API response)
      if (userObj.profileImage.length > 100000) {
        console.warn(`ProfileImage too large (${userObj.profileImage.length} bytes), excluding from response`);
        userObj.profileImage = undefined;
      }
    }

    const response = NextResponse.json({ user: userObj });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    return response;
  } catch (error: any) {
    console.error('Get profile error:', error);
    const errorResponse = NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    return errorResponse;
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, mobileNumber, dateOfBirth, joiningYear, profileImage, currentPassword, newPassword, bankName, accountNumber, ifscCode } = await request.json();

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

    // Update joining year
    if (joiningYear !== undefined) {
      console.log('[Profile API] joiningYear received:', joiningYear, 'Type:', typeof joiningYear);
      
      // Handle null or empty values
      if (joiningYear === null || joiningYear === '') {
        updateFields.joiningYear = null;
        console.log('[Profile API] Setting joiningYear to null');
      } else {
        // Convert to number if it's a string
        const yearNum = typeof joiningYear === 'string' ? parseInt(joiningYear, 10) : joiningYear;
        console.log('[Profile API] Parsed yearNum:', yearNum, 'isNaN:', isNaN(yearNum), 'Valid range:', yearNum >= 1900 && yearNum <= 2100);
        
        if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
          updateFields.joiningYear = yearNum;
          console.log('[Profile API] Setting joiningYear to:', yearNum);
        } else {
          console.log('[Profile API] Invalid joiningYear, skipping update');
        }
      }
    }

    // Update profile image
    if (profileImage !== undefined) {
      updateFields.profileImage = profileImage;
    }

    // Update bank details
    if (bankName !== undefined) {
      updateFields.bankName = bankName || null;
    }
    if (accountNumber !== undefined) {
      updateFields.accountNumber = accountNumber || null;
    }
    if (ifscCode !== undefined) {
      updateFields.ifscCode = ifscCode ? ifscCode.toUpperCase().trim() : null;
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

    console.log('[Profile API] Update fields to save:', updateFields);

    // Update user using findByIdAndUpdate to ensure all fields are saved
    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      { $set: updateFields }, 
      { new: true, runValidators: true }
    );

    console.log('[Profile API] User updated, joiningYear in DB:', updatedUser?.joiningYear);

    // Generate employee ID if joining year was updated and empId doesn't exist or needs update
    if (updateFields.joiningYear && updatedUser) {
      // Check if we need to regenerate empId (either doesn't exist or year changed)
      const needsEmpId = await shouldGenerateEmployeeId(userId, updateFields.joiningYear);
      console.log('[Profile API] Needs empId regeneration:', needsEmpId);
      
      if (needsEmpId) {
        const empId = await generateEmployeeId(updateFields.joiningYear);
        await User.findByIdAndUpdate(userId, { $set: { empId } });
        console.log('[Profile API] Generated and saved new empId:', empId);
      }
    }

    // Return updated user without password
    // Exclude profileImage from response to prevent slow API responses
    // The frontend already has the image if it was just updated
    const userResponse = await User.findById(userId).select('-password -profileImage').lean();

    if (!userResponse) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If profileImage was just updated, include it in response (it's already in the updateFields)
    if (updateFields.profileImage !== undefined) {
      // Only include if it's not too large
      if (updateFields.profileImage && typeof updateFields.profileImage === 'string' && updateFields.profileImage.length <= 100000) {
        userResponse.profileImage = updateFields.profileImage;
      } else if (updateFields.profileImage === null) {
        userResponse.profileImage = undefined;
      }
    }

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: userResponse,
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

