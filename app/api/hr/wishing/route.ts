import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import ScheduledEmail from '@/models/ScheduledEmail';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role;
    if (role !== 'hr' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userIds, subject, html } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 });
    }
    if (!subject || !html) {
      return NextResponse.json({ error: 'Subject and HTML body are required' }, { status: 400 });
    }

    await connectDB();
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      return NextResponse.json(
        { error: 'SMTP configuration is missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.' },
        { status: 500 }
      );
    }

    const recipients = await User.find({ _id: { $in: userIds } })
      .select('email name')
      .lean();

    const validRecipients = recipients.filter((u: any) => u?.email);

    if (validRecipients.length === 0) {
      return NextResponse.json({ error: 'No valid email addresses found.' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Save to email history first to get the ID
    const emailHistory = new ScheduledEmail({
      userIds,
      subject,
      html,
      sent: true,
      sentAt: new Date(),
      createdBy: (session.user as any).id,
      openedBy: [],
    });

    const savedEmail = await emailHistory.save();
    console.log(`Email history saved with ID: ${savedEmail._id}`);
    console.log(`Email history saved - sent: ${savedEmail.sent}, sentAt: ${savedEmail.sentAt}`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Send personalized emails to each recipient with tracking pixel
    const sendPromises = validRecipients.map(async (recipient: any) => {
      // Replace ${data.employeeName} with actual employee name
      const personalizedHtml = html.replace(/\$\{data\.employeeName\}/g, recipient.name || 'Employee');
      const personalizedSubject = subject.replace(/\$\{data\.employeeName\}/g, recipient.name || 'Employee');

      // Add tracking pixel at the end of the HTML
      const trackingPixel = `<img src="${baseUrl}/api/hr/wishing/track?emailId=${emailHistory._id}&userId=${recipient._id}" width="1" height="1" style="display:none;" alt="" />`;
      const htmlWithTracking = personalizedHtml + trackingPixel;

      return transporter.sendMail({
        from: smtpFrom,
        to: recipient.email,
        subject: personalizedSubject,
        html: htmlWithTracking,
      });
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, sent: validRecipients.length });
  } catch (error: any) {
    console.error('HR wishing send error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any)?.role;
    if (role !== 'hr' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    // Get sent email history (last 50) - get all sent emails
    const emailHistoryRaw = await ScheduledEmail.find({ 
      sent: true
    })
      .populate('userIds', 'name email profileImage')
      .populate('createdBy', 'name email')
      .sort({ sentAt: -1, createdAt: -1 }) // Fallback to createdAt if sentAt doesn't exist
      .limit(50)
      .lean();

    // Manually populate openedBy to avoid schema cache issues
    const emailHistory = await Promise.all(
      emailHistoryRaw.map(async (email: any) => {
        // Check if openedBy exists and has values
        const openedByIds = email.openedBy || [];
        if (Array.isArray(openedByIds) && openedByIds.length > 0) {
          try {
            // Handle both ObjectId strings and objects - convert all to strings for comparison
            const ids = openedByIds.map((id: any) => {
              if (typeof id === 'string') return id;
              if (id && id.toString) return id.toString();
              if (id && id._id) return id._id.toString();
              return String(id);
            }).filter(Boolean);
            
            if (ids.length > 0) {
              const openedUsers = await User.find({ _id: { $in: ids } })
                .select('name email profileImage')
                .lean();
              // Store both the populated users and the IDs for comparison
              email.openedBy = openedUsers;
              email.openedByIds = ids; // Keep IDs as strings for frontend comparison
            } else {
              email.openedBy = [];
              email.openedByIds = [];
            }
          } catch (err) {
            console.warn('Error populating openedBy:', err);
            email.openedBy = [];
            email.openedByIds = [];
          }
        } else {
          email.openedBy = [];
          email.openedByIds = [];
        }
        return email;
      })
    );

    console.log(`Fetched ${emailHistory.length} email history records`);
    
    // Debug: Log first record if exists
    if (emailHistory.length > 0) {
      console.log('Sample email history record:', JSON.stringify(emailHistory[0], null, 2));
    }

    return NextResponse.json({ 
      emailHistory,
      count: emailHistory.length 
    });
  } catch (error: any) {
    console.error('Error fetching email history:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

