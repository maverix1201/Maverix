import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Resignation from '@/models/Resignation';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

// GET - Fetch resignations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    const userId = (session.user as any)?.id;

    await connectDB();

    let query: any = {};

    // Employees can only see their own resignations
    if (role === 'employee') {
      query.userId = userId;
    }
    // Admin and HR can see all resignations

    const resignations = await Resignation.find(query)
      .populate('userId', 'name email profileImage empId designation')
      .populate('approvedBy', 'name email')
      .select('userId resignationDate reason feedback assets noticePeriodStartDate noticePeriodEndDate noticePeriodComplied handoverNotes knowledgeTransferCompleted assetsReturned clearances exitInterviewCompleted fnfStatus exitDocuments systemAccessDeactivated exitClosed status approvedBy approvedAt rejectionReason createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Ensure assets are always arrays and properly formatted, and notice period dates are included
    const processedResignations = resignations.map((r: any) => {
      let assetsArray: string[] = [];
      
      // Handle different possible formats
      if (r.assets !== undefined && r.assets !== null) {
        if (Array.isArray(r.assets)) {
          // Filter out null, undefined, and empty strings
          assetsArray = r.assets.filter((a: any) => a != null && a !== '' && String(a).trim() !== '');
        } else if (typeof r.assets === 'string' && r.assets.trim() !== '') {
          assetsArray = [r.assets];
        }
      }
      
      // Ensure notice period dates are properly included and formatted
      const processed = {
        ...r,
        assets: assetsArray,
        noticePeriodStartDate: r.noticePeriodStartDate 
          ? (typeof r.noticePeriodStartDate === 'string' ? r.noticePeriodStartDate : new Date(r.noticePeriodStartDate).toISOString())
          : undefined,
        noticePeriodEndDate: r.noticePeriodEndDate 
          ? (typeof r.noticePeriodEndDate === 'string' ? r.noticePeriodEndDate : new Date(r.noticePeriodEndDate).toISOString())
          : undefined,
        noticePeriodComplied: r.noticePeriodComplied || false,
      };
      
      console.log(`Resignation ${r._id}:`, {
        assets: assetsArray,
        noticePeriodStartDate: processed.noticePeriodStartDate,
        noticePeriodEndDate: processed.noticePeriodEndDate,
        rawStart: r.noticePeriodStartDate,
        rawEnd: r.noticePeriodEndDate,
      });
      
      return processed;
    });

    console.log('=== FETCHED RESIGNATIONS ===');
    processedResignations.forEach((r: any) => {
      console.log(`ID: ${r._id}, Assets:`, r.assets, 'Type:', typeof r.assets, 'IsArray:', Array.isArray(r.assets), 'Length:', r.assets?.length);
    });

    return NextResponse.json({ resignations: processedResignations }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching resignations:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// POST - Submit resignation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;

    // Only employees can submit resignations
    if (role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can submit resignations' }, { status: 403 });
    }

    const {
      resignationDate,
      reason,
      feedback,
      assets,
      noticePeriodStartDate,
      noticePeriodEndDate,
      handoverNotes,
      clearancesAcknowledged,
    } = await request.json();
    const userId = (session.user as any)?.id;

    console.log('=== RECEIVED RESIGNATION DATA ===');
    console.log('Full data:', {
      resignationDate,
      reason,
      feedback,
      assets,
      noticePeriodStartDate,
      noticePeriodEndDate,
      handoverNotes,
      clearancesAcknowledged,
    });
    console.log('Notice period dates:', {
      start: noticePeriodStartDate,
      end: noticePeriodEndDate,
      startType: typeof noticePeriodStartDate,
      endType: typeof noticePeriodEndDate,
    });

    if (!resignationDate || !reason) {
      return NextResponse.json(
        { error: 'Resignation date and reason are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user already has a pending resignation
    const existingResignation = await Resignation.findOne({
      userId,
      status: 'pending',
    });

    if (existingResignation) {
      return NextResponse.json(
        { error: 'You already have a pending resignation request' },
        { status: 400 }
      );
    }

    // Ensure assets is always an array - be very explicit
    let assetsArray: string[] = [];
    if (assets !== undefined && assets !== null) {
      if (Array.isArray(assets)) {
        // Filter out any invalid values
        assetsArray = assets.filter((a: any) => a != null && a !== '' && String(a).trim() !== '');
      } else if (typeof assets === 'string' && assets.trim() !== '') {
        assetsArray = [assets.trim()];
      }
    }
    
    console.log('=== PROCESSING ASSETS ===');
    console.log('Raw assets input:', assets);
    console.log('Assets type:', typeof assets);
    console.log('Assets is array:', Array.isArray(assets));
    console.log('Processed assets array:', assetsArray);
    console.log('Assets array length:', assetsArray.length);

    // Ensure notice period dates are properly formatted
    let noticeStart: Date | null = null;
    let noticeEnd: Date | null = null;
    
    // Handle notice period start date - check for null, undefined, or empty string
    if (noticePeriodStartDate != null && noticePeriodStartDate !== '' && String(noticePeriodStartDate).trim() !== '') {
      try {
        const parsedStart = new Date(noticePeriodStartDate);
        if (!isNaN(parsedStart.getTime())) {
          noticeStart = parsedStart;
          console.log('Successfully parsed notice period start date:', noticeStart);
        } else {
          console.error('Invalid notice period start date (NaN):', noticePeriodStartDate);
        }
      } catch (error) {
        console.error('Error parsing notice period start date:', noticePeriodStartDate, error);
      }
    } else {
      console.log('Notice period start date is null, undefined, or empty - skipping');
    }
    
    // Handle notice period end date - check for null, undefined, or empty string
    if (noticePeriodEndDate != null && noticePeriodEndDate !== '' && String(noticePeriodEndDate).trim() !== '') {
      try {
        const parsedEnd = new Date(noticePeriodEndDate);
        if (!isNaN(parsedEnd.getTime())) {
          noticeEnd = parsedEnd;
          console.log('Successfully parsed notice period end date:', noticeEnd);
        } else {
          console.error('Invalid notice period end date (NaN):', noticePeriodEndDate);
        }
      } catch (error) {
        console.error('Error parsing notice period end date:', noticePeriodEndDate, error);
      }
    } else {
      console.log('Notice period end date is null, undefined, or empty - skipping');
    }
    
    console.log('=== NOTICE PERIOD PROCESSING ===');
    console.log('Raw noticePeriodStartDate:', noticePeriodStartDate);
    console.log('Raw noticePeriodEndDate:', noticePeriodEndDate);
    console.log('Processed noticeStart:', noticeStart);
    console.log('Processed noticeEnd:', noticeEnd);
    console.log('Notice start type:', typeof noticeStart);
    console.log('Notice end type:', typeof noticeEnd);

    // Build resignation object with all fields explicitly set
    const resignationData: any = {
      userId,
      resignationDate: new Date(resignationDate),
      reason,
      feedback: feedback || '',
      assets: assetsArray.length > 0 ? assetsArray : [],
      handoverNotes: handoverNotes || '',
      status: 'pending',
      // Initialize clearances with proper structure
      clearances: {
        design: { status: 'pending' },
        operation: { status: 'pending' },
      },
    };

    // Only add notice period dates if they have valid values
    if (noticeStart !== null) {
      resignationData.noticePeriodStartDate = noticeStart;
      console.log('Adding noticePeriodStartDate to resignation:', noticeStart);
    } else {
      console.log('Skipping noticePeriodStartDate (null or invalid)');
    }

    if (noticeEnd !== null) {
      resignationData.noticePeriodEndDate = noticeEnd;
      console.log('Adding noticePeriodEndDate to resignation:', noticeEnd);
    } else {
      console.log('Skipping noticePeriodEndDate (null or invalid)');
    }

    console.log('=== RESIGNATION DATA TO SAVE ===');
    console.log('Resignation data keys:', Object.keys(resignationData));
    console.log('Notice period in data:', {
      start: resignationData.noticePeriodStartDate,
      end: resignationData.noticePeriodEndDate,
    });
    console.log('Clearances in data:', resignationData.clearances);

    const resignation = new Resignation(resignationData);
    
    // Explicitly mark fields as modified to ensure they're saved
    if (resignationData.noticePeriodStartDate) {
      resignation.markModified('noticePeriodStartDate');
    }
    if (resignationData.noticePeriodEndDate) {
      resignation.markModified('noticePeriodEndDate');
    }
    resignation.markModified('clearances');
    resignation.markModified('assets');
    
    console.log('=== BEFORE SAVE ===');
    console.log('Resignation object:', {
      assets: resignation.assets,
      noticePeriodStartDate: resignation.noticePeriodStartDate,
      noticePeriodEndDate: resignation.noticePeriodEndDate,
      clearances: resignation.clearances,
    });
    console.log('Resignation object keys:', Object.keys(resignation.toObject()));
    console.log('Is noticePeriodStartDate modified?', resignation.isModified('noticePeriodStartDate'));
    console.log('Is noticePeriodEndDate modified?', resignation.isModified('noticePeriodEndDate'));
    console.log('Is clearances modified?', resignation.isModified('clearances'));

    // Save the resignation with explicit validation
    await resignation.save({ validateBeforeSave: true });
    
    console.log('=== AFTER SAVE ===');
    console.log('Resignation ID:', resignation._id);
    console.log('Saved document:', {
      assets: resignation.assets,
      noticePeriodStartDate: resignation.noticePeriodStartDate,
      noticePeriodEndDate: resignation.noticePeriodEndDate,
      clearances: resignation.clearances,
    });
    
    // Reload from database to ensure we have the latest data - use lean() to get plain object
    const savedResignationRaw = await Resignation.findById(resignation._id).lean();
    
    if (!savedResignationRaw || Array.isArray(savedResignationRaw)) {
      throw new Error('Failed to retrieve saved resignation');
    }
    
    // Type assertion: findById().lean() returns a single document or null, not an array
    const resignationDoc = savedResignationRaw as any;
    
    console.log('=== AFTER RELOAD (lean) ===');
    console.log('Raw saved resignation:', {
      assets: resignationDoc.assets,
      noticePeriodStartDate: resignationDoc.noticePeriodStartDate,
      noticePeriodEndDate: resignationDoc.noticePeriodEndDate,
      clearances: resignationDoc.clearances,
    });
    console.log('All keys in saved document:', Object.keys(savedResignationRaw));
    
    // Also get the full document for population
    const savedResignation = await Resignation.findById(resignation._id);
    if (!savedResignation) {
      throw new Error('Failed to retrieve saved resignation for population');
    }
    
    console.log('=== AFTER RELOAD (full document) ===');
    console.log('Full document assets:', savedResignation.assets);
    console.log('Full document notice period:', {
      start: savedResignation.noticePeriodStartDate,
      end: savedResignation.noticePeriodEndDate,
    });
    
    await savedResignation.populate('userId', 'name email profileImage empId designation');

    // Convert to plain object
    const responseData = savedResignation.toObject();
    
    // CRITICAL: Explicitly set assets from the raw lean() result which is what's actually in DB
    responseData.assets = Array.isArray(resignationDoc.assets) 
      ? resignationDoc.assets.filter((a: any) => a != null && a !== '')
      : (resignationDoc.assets ? [resignationDoc.assets] : []);
    
    // CRITICAL: Explicitly set notice period dates from the raw lean() result
    responseData.noticePeriodStartDate = resignationDoc.noticePeriodStartDate 
      ? (typeof resignationDoc.noticePeriodStartDate === 'string' 
          ? resignationDoc.noticePeriodStartDate 
          : new Date(resignationDoc.noticePeriodStartDate).toISOString())
      : undefined;
    responseData.noticePeriodEndDate = resignationDoc.noticePeriodEndDate 
      ? (typeof resignationDoc.noticePeriodEndDate === 'string' 
          ? resignationDoc.noticePeriodEndDate 
          : new Date(resignationDoc.noticePeriodEndDate).toISOString())
      : undefined;
    
    // CRITICAL: Explicitly set clearances from the raw lean() result
    responseData.clearances = resignationDoc.clearances || {
      reportingManager: { status: 'pending' },
      it: { status: 'pending' },
      admin: { status: 'pending' },
      finance: { status: 'pending' },
    };
    
    console.log('=== FINAL RESPONSE DATA ===');
    console.log('Response assets:', responseData.assets);
    console.log('Response notice period:', {
      start: responseData.noticePeriodStartDate,
      end: responseData.noticePeriodEndDate,
      rawStart: resignationDoc.noticePeriodStartDate,
      rawEnd: resignationDoc.noticePeriodEndDate,
    });
    console.log('Response clearances:', responseData.clearances);
    
    return NextResponse.json(
      { message: 'Resignation submitted successfully', resignation: responseData },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error submitting resignation:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
