import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Leave from '@/models/Leave';
import Penalty from '@/models/Penalty';
import Finance from '@/models/Finance';
import mongoose from 'mongoose';
import { generateEmployeeId, shouldGenerateEmployeeId } from '@/utils/generateEmployeeId';

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

    const userRole = (session.user as any).role;
    if (userRole !== 'admin' && userRole !== 'hr') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, role, designation, joiningYear, weeklyOff, clockInTime } = body;

    // Debug logging
    console.log('[Update User] Request body:', JSON.stringify(body));
    console.log('[Update User] weeklyOff received:', weeklyOff);
    console.log('[Update User] clockInTime received:', clockInTime);

    await connectDB();

    const user = await User.findById(params.id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent HR from changing user roles
    if (userRole === 'hr' && role && role !== user.role) {
      return NextResponse.json({ error: 'HR cannot change user roles' }, { status: 403 });
    }

    if (name) user.name = name;
    // Only allow role change if user is admin
    if (role && userRole === 'admin') {
      user.role = role;
    }
    if (designation !== undefined) {
      user.designation = designation && designation.trim() !== '' ? designation.trim() : undefined;
    }
    
    // Update joining year if provided
    if (joiningYear !== undefined) {
      const yearNum = typeof joiningYear === 'string' ? parseInt(joiningYear, 10) : joiningYear;
      if (yearNum && !isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
        user.joiningYear = yearNum;
        console.log('[Update User] Setting joiningYear to:', yearNum);
      } else if (joiningYear === null) {
        user.joiningYear = undefined;
        console.log('[Update User] Clearing joiningYear');
      }
    }
    
    // Always update weeklyOff - it should always be in the request body
    // Process weeklyOff regardless of whether it's provided or not
    if (weeklyOff !== undefined) {
      const filteredWeeklyOff = Array.isArray(weeklyOff)
        ? weeklyOff.filter(day => day && typeof day === 'string' && day.trim())
        : [];
      user.weeklyOff = filteredWeeklyOff;
      user.markModified('weeklyOff'); // Explicitly mark as modified for Mongoose
      console.log('[Update User] Setting weeklyOff to:', user.weeklyOff);
    } else {
      console.log('[Update User] weeklyOff not provided, keeping existing value:', user.weeklyOff);
    }
    
    // Update clockInTime if provided (can be empty string to clear it, or "N/R" for no restrictions)
    // Always process clockInTime if it's in the request body (even if empty string)
    if (clockInTime !== undefined) {
      console.log('[Update User] Processing clockInTime:', clockInTime, 'Type:', typeof clockInTime, 'Length:', clockInTime?.length, 'IsEmpty:', clockInTime === '');
      // Handle both empty string and null/undefined
      const timeValue = typeof clockInTime === 'string' ? clockInTime.trim() : '';
      
      if (timeValue === 'N/R') {
        // Special marker for "No Restrictions"
        // Use updateOne to set this value directly, bypassing validation
        await User.updateOne(
          { _id: params.id },
          { clockInTime: 'N/R' },
          { runValidators: false }
        );
        // Reload user to get the updated clockInTime
        const reloadedUser = await User.findById(params.id);
        if (reloadedUser) {
          Object.assign(user, { clockInTime: 'N/R' });
        }
        console.log('[Update User] Setting clockInTime to "N/R" (No Restrictions) via updateOne');
      } else if (timeValue !== '') {
        // Validate time format (HH:mm)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(timeValue)) {
          console.log('[Update User] Invalid time format:', timeValue);
          return NextResponse.json(
            { error: 'Invalid clock-in time format. Please use HH:mm format (e.g., 09:30)' },
            { status: 400 }
          );
        }
        user.clockInTime = timeValue;
        user.markModified('clockInTime'); // Explicitly mark as modified for Mongoose
        console.log('[Update User] Setting clockInTime to:', user.clockInTime);
      } else {
        // Clear clockInTime if empty string is provided
        // Set to undefined and mark as modified
        user.clockInTime = undefined;
        user.markModified('clockInTime'); // Explicitly mark as modified for Mongoose
        console.log('[Update User] Clearing clockInTime (setting to undefined)');
      }
    } else {
      console.log('[Update User] clockInTime not provided in request (undefined), keeping existing value:', user.clockInTime);
    }
    
    console.log('[Update User] weeklyOff received:', weeklyOff);
    console.log('[Update User] User weeklyOff before save:', user.weeklyOff);
    console.log('[Update User] User clockInTime before save:', user.clockInTime);

    const saveResult = await user.save();
    console.log('[Update User] Save result weeklyOff:', saveResult.weeklyOff);
    console.log('[Update User] Save result clockInTime:', saveResult.clockInTime);
    
    // Generate employee ID if joining year was updated and empId doesn't exist or needs update
    if (joiningYear !== undefined && user.joiningYear) {
      console.log('[Update User] Checking if empId needs regeneration for year:', user.joiningYear);
      const needsEmpId = await shouldGenerateEmployeeId(params.id, user.joiningYear);
      console.log('[Update User] Needs empId regeneration:', needsEmpId);
      
      if (needsEmpId) {
        const empId = await generateEmployeeId(user.joiningYear);
        await User.findByIdAndUpdate(params.id, { $set: { empId } });
        console.log('[Update User] Generated and saved new empId:', empId);
      } else {
        console.log('[Update User] EmpId regeneration not needed, keeping existing:', user.empId);
      }
    }
    
    // Reload user to ensure all fields are properly saved
    const updatedUser = await User.findById(params.id)
      .select('_id name email role empId designation profileImage mobileNumber joiningYear emailVerified approved weeklyOff clockInTime createdAt updatedAt')
      .lean();

    console.log('[Update User] Updated user weeklyOff from DB:', updatedUser?.weeklyOff);
    console.log('[Update User] Updated user clockInTime from DB:', updatedUser?.clockInTime);
    console.log('[Update User] Updated user weeklyOff type:', typeof updatedUser?.weeklyOff);
    console.log('[Update User] Updated user weeklyOff isArray:', Array.isArray(updatedUser?.weeklyOff));
    console.log('[Update User] Updated user (full):', JSON.stringify(updatedUser, null, 2));

    return NextResponse.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Update user error:', error);
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

    const userRole = (session.user as any).role;
    if (userRole !== 'admin' && userRole !== 'hr') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(params.id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Cannot delete admin user' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(params.id);

    // Delete all related records for this user
    try {
      // Delete attendance records
      await Attendance.deleteMany({ userId });
      
      // Delete leave records
      await Leave.deleteMany({ userId });
      
      // Delete penalty records
      await Penalty.deleteMany({ userId });
      
      // Delete finance records
      await Finance.deleteMany({ userId });
      
      // Finally, delete the user
      await User.findByIdAndDelete(params.id);
    } catch (deleteError: any) {
      console.error('Error deleting user and related records:', deleteError);
      // If deletion of related records fails, still try to delete the user
      // (MongoDB doesn't have foreign key constraints, so this should work)
      await User.findByIdAndDelete(params.id);
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

