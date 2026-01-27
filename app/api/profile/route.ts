import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { generateEmployeeId, extractEmployeeIdSequence } from '@/utils/generateEmployeeId';

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

    const { name, mobileNumber, dateOfBirth, joiningYear, profileImage, currentPassword, newPassword, bankName, accountNumber, ifscCode, location, panNumber, aadharNumber } = await request.json();

    await connectDB();

    const userId = (session.user as any).id;
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const previousJoiningYear = user.joiningYear ?? null;
    const isClearingJoiningYear =
      joiningYear === null || joiningYear === '' || (typeof joiningYear === 'string' && joiningYear.trim() === '');

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
      // Handle null or empty values
      if (isClearingJoiningYear) {
        // We'll unset in the DB update operation below; keep updateFields minimal.
      } else {
        // Convert to number if it's a string
        const yearNum = typeof joiningYear === 'string' ? parseInt(joiningYear, 10) : joiningYear;
        
        if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
          updateFields.joiningYear = yearNum;
          // Track the time joiningYear was first set (for global empId ordering)
          if (!previousJoiningYear) {
            updateFields.joiningYearUpdatedAt = new Date();
          }
        }
      }
    }

    // Update profile image
    if (profileImage !== undefined) {
      updateFields.profileImage = profileImage;
    }

    // Update bank details
    if (bankName !== undefined) {
      updateFields.bankName = bankName && bankName.trim() !== '' ? bankName.trim() : null;
    }
    if (accountNumber !== undefined) {
      updateFields.accountNumber = accountNumber && accountNumber.trim() !== '' ? accountNumber.trim() : null;
    }
    if (ifscCode !== undefined) {
      updateFields.ifscCode = ifscCode && ifscCode.trim() !== '' ? ifscCode.toUpperCase().trim() : null;
    }

    // Update location - always update if provided (even if empty string)
    // Explicitly check for undefined to distinguish from empty string
    if (location !== undefined && location !== null) {
      const trimmedLocation = typeof location === 'string' ? location.trim() : location;
      updateFields.location = trimmedLocation && trimmedLocation !== '' ? trimmedLocation : null;
    } else if (location === null || location === '') {
      // Explicitly set to null if provided as null or empty string
      updateFields.location = null;
    }

    // Update PAN number - always update if provided (even if empty string)
    if (panNumber !== undefined && panNumber !== null) {
      const trimmedPan = typeof panNumber === 'string' ? panNumber.trim() : panNumber;
      updateFields.panNumber = trimmedPan && trimmedPan !== '' ? trimmedPan.toUpperCase() : null;
    } else if (panNumber === null || panNumber === '') {
      updateFields.panNumber = null;
    }

    // Update Aadhar number - always update if provided (even if empty string)
    if (aadharNumber !== undefined && aadharNumber !== null) {
      const trimmedAadhar = typeof aadharNumber === 'string' ? aadharNumber.trim() : aadharNumber;
      updateFields.aadharNumber = trimmedAadhar && trimmedAadhar !== '' ? trimmedAadhar : null;
    } else if (aadharNumber === null || aadharNumber === '') {
      updateFields.aadharNumber = null;
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

    // Ensure we have at least one field to update.
    // Note: clearing joiningYear sends `joiningYear` but results in only $unset operations.
    if (Object.keys(updateFields).length === 0 && joiningYear === undefined) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Update user using findByIdAndUpdate to ensure all fields are saved
    const updateOp: any = { $set: updateFields };
    if (isClearingJoiningYear) {
      updateOp.$unset = { joiningYear: '', joiningYearUpdatedAt: '', empId: '' };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateOp, {
      new: true,
      runValidators: true,
    });

    // If joiningYear was cleared, it was unset together with empId in the update operation above.

    // Employee ID rule:
    // - When joiningYear is set, empId should be YYYYEMP-### using a GLOBAL sequence.
    // - If joiningYear changes later, update only the year prefix and keep the same ### sequence.
    if (updatedUser?.joiningYear) {
      const currentEmpId = updatedUser.empId;
      if (!currentEmpId) {
        const empId = await generateEmployeeId(updatedUser.joiningYear);
        await User.findByIdAndUpdate(userId, { $set: { empId } });
      } else {
        const seq = extractEmployeeIdSequence(currentEmpId);
        const expectedPrefix = `${updatedUser.joiningYear}EMP-`;
        if (seq !== null && !currentEmpId.startsWith(expectedPrefix)) {
          const newEmpId = `${updatedUser.joiningYear}EMP-${String(seq).padStart(3, '0')}`;
          await User.findByIdAndUpdate(userId, { $set: { empId: newEmpId } });
        }
      }
    }

    // Use the updatedUser directly instead of querying again to ensure we have the latest data
    // Convert to plain object and exclude sensitive fields
    let userResponse: any;
    
    if (updatedUser) {
      userResponse = updatedUser.toObject ? updatedUser.toObject() : updatedUser;
      // Remove password and profileImage from response
      delete userResponse.password;
      if (!updateFields.profileImage) {
        delete userResponse.profileImage;
      }
    } else {
      // Fallback: query the user if updatedUser is not available
      const queriedUser = await User.findById(userId)
        .select('-password -profileImage')
        .lean();
      
      if (!queriedUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      userResponse = queriedUser;
    }
    
    // Explicitly ensure these fields are in the response (even if null/undefined)
    // This guarantees they're always included in the JSON response
    userResponse.location = userResponse.location !== undefined ? userResponse.location : null;
    userResponse.panNumber = userResponse.panNumber !== undefined ? userResponse.panNumber : null;
    userResponse.aadharNumber = userResponse.aadharNumber !== undefined ? userResponse.aadharNumber : null;

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

