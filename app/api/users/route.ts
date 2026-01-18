import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendVerificationEmail } from '@/utils/sendEmail';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    // Return all non-admin users (employee + hr) for admin/hr roles
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('_id name email role empId designation profileImage mobileNumber joiningYear emailVerified approved weeklyOff clockInTime createdAt')
      .lean();

    // Debug logging to verify weeklyOff is being returned
    console.log('[Get Users] Users with weeklyOff:', users.map((u: any) => ({ 
      name: u.name, 
      email: u.email, 
      weeklyOff: u.weeklyOff,
      weeklyOffType: typeof u.weeklyOff,
      weeklyOffIsArray: Array.isArray(u.weeklyOff)
    })));

    const response = NextResponse.json({ users });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    return response;
  } catch (error: any) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'admin' && userRole !== 'hr') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, name, role, designation, weeklyOff, clockInTime } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Prevent HR from setting roles - default to 'employee'
    const finalRole = userRole === 'hr' ? 'employee' : (role || 'employee');
    
    // Prevent HR from creating admin or hr users
    if (userRole === 'hr' && (finalRole === 'admin' || finalRole === 'hr')) {
      return NextResponse.json({ error: 'HR cannot create admin or HR users' }, { status: 403 });
    }

    await connectDB();

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Explicitly set approved status based on role
    let approvedStatus = false;
    if (finalRole === 'admin' || finalRole === 'hr') {
      approvedStatus = true; // Auto-approve admin and HR
    } else {
      approvedStatus = false; // Employees need admin approval
    }

    // Validate clockInTime if provided (allow "N/R" as special marker)
    let finalClockInTime = undefined;
    if (clockInTime && clockInTime.trim() !== '') {
      const trimmedTime = clockInTime.trim();
      if (trimmedTime === 'N/R') {
        // Special marker for "No Restrictions"
        finalClockInTime = 'N/R';
      } else {
        // Validate time format (HH:mm)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(trimmedTime)) {
          return NextResponse.json(
            { error: 'Invalid clock-in time format. Please use HH:mm format (e.g., 09:30)' },
            { status: 400 }
          );
        }
        finalClockInTime = trimmedTime;
      }
    }

    const user = new User({
      email: email.toLowerCase(),
      name,
      role: finalRole,
      designation: designation || undefined,
      weeklyOff: Array.isArray(weeklyOff) ? weeklyOff.filter(day => day && day.trim()) : [],
      clockInTime: finalClockInTime,
      verificationToken,
      verificationTokenExpiry,
      emailVerified: false,
      approved: approvedStatus, // Explicitly set approval status
    });

    await user.save();

    await sendVerificationEmail(user.email, verificationToken, user.name);

    return NextResponse.json({
      message: 'User created successfully. Verification email sent.',
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        designation: user.designation,
        emailVerified: user.emailVerified,
        weeklyOff: user.weeklyOff || [],
        clockInTime: user.clockInTime,
      },
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

