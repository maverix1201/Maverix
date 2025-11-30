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

    const users = await User.find({ role: 'employee' })
      .select('_id name email role designation profileImage mobileNumber emailVerified')
      .lean();

    return NextResponse.json({ users });
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

    const { email, name, role, designation } = await request.json();

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

    const user = new User({
      email: email.toLowerCase(),
      name,
      role: finalRole,
      designation: designation || undefined,
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
      },
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

