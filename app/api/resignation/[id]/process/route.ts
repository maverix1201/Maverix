import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Resignation from '@/models/Resignation';
import mongoose, { Types } from 'mongoose';

export const dynamic = 'force-dynamic';

// Note: For file uploads, files should be uploaded separately via /api/profile/upload
// and the resulting data URL should be passed in the 'files' field

// PATCH - Update exit process fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any)?.role;
    const userId = (session.user as any)?.id;

    // Only admin and HR can update exit process
    if (role !== 'admin' && role !== 'hr') {
      return NextResponse.json(
        { error: 'Only admin and HR can update exit process' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { field, value, department, notes, date, amount, status: stepStatus, files } = body;

    await connectDB();

    const resignation = await Resignation.findById(params.id);

    if (!resignation) {
      return NextResponse.json({ error: 'Resignation not found' }, { status: 404 });
    }

    // Update based on field type
    switch (field) {
      case 'noticePeriodComplied':
        resignation.noticePeriodComplied = value === true;
        if (value === true && date) {
          // If marking as complied, we can store a compliance date
          resignation.markModified('noticePeriodComplied');
        }
        break;

      case 'knowledgeTransferCompleted':
        resignation.knowledgeTransferCompleted = value === true;
        if (value === true) {
          resignation.handoverCompletedDate = date ? new Date(date) : new Date();
        }
        resignation.markModified('knowledgeTransferCompleted');
        resignation.markModified('handoverCompletedDate');
        break;

      case 'assetsReturned':
        resignation.assetsReturned = value === true;
        if (value === true) {
          resignation.assetsReturnDate = date ? new Date(date) : new Date();
          if (notes) {
            resignation.assetsReturnNotes = notes;
          }
        }
        resignation.markModified('assetsReturned');
        resignation.markModified('assetsReturnDate');
        resignation.markModified('assetsReturnNotes');
        break;

      case 'clearance':
        // Update individual department clearance
        console.log('=== UPDATING CLEARANCE ===');
        console.log('Department:', department);
        console.log('Status:', stepStatus);
        console.log('Notes:', notes);
        console.log('User ID:', userId);
        console.log('Current clearances before update:', JSON.stringify(resignation.clearances, null, 2));
        
        if (department && ['design', 'operation'].includes(department)) {
          // Initialize clearances if it doesn't exist
          if (!resignation.clearances) {
            resignation.set('clearances', {
              design: { status: 'pending' },
              operation: { status: 'pending' },
            });
          }
          
          // Use set() to update nested paths - this ensures Mongoose detects the change
          const clearanceUpdate: any = {
            status: stepStatus,
            approvedBy: new mongoose.Types.ObjectId(userId),
            approvedAt: new Date(),
          };
          
          if (notes) {
            clearanceUpdate.notes = notes;
          }
          
          // Use set() method for nested paths
          resignation.set(`clearances.${department}`, clearanceUpdate);
          
          // Also mark as modified explicitly
          resignation.markModified('clearances');
          resignation.markModified(`clearances.${department}`);
          
          console.log('Clearances after update (before save):', JSON.stringify(resignation.clearances, null, 2));
          console.log('Is clearances modified?', resignation.isModified('clearances'));
          console.log(`Is clearances.${department} modified?`, resignation.isModified(`clearances.${department}`));
        } else {
          return NextResponse.json(
            { error: 'Invalid department' },
            { status: 400 }
          );
        }
        break;

      case 'exitInterviewCompleted':
        resignation.exitInterviewCompleted = value === true;
        if (value === true) {
          resignation.exitInterviewDate = date ? new Date(date) : new Date();
          if (notes) {
            resignation.exitInterviewFeedback = notes;
          }
        }
        resignation.markModified('exitInterviewCompleted');
        resignation.markModified('exitInterviewDate');
        resignation.markModified('exitInterviewFeedback');
        break;

      case 'fnfStatus':
        resignation.fnfStatus = stepStatus; // 'processing' or 'completed'
        if (stepStatus === 'completed') {
          resignation.fnfProcessedDate = date ? new Date(date) : new Date();
          if (amount !== undefined) {
            resignation.fnfAmount = amount;
          }
          if (notes) {
            resignation.fnfNotes = notes;
          }
        }
        resignation.markModified('fnfStatus');
        resignation.markModified('fnfProcessedDate');
        resignation.markModified('fnfAmount');
        resignation.markModified('fnfNotes');
        break;

      case 'exitDocuments':
        // Handle file uploads for exit documents
        if (!resignation.exitDocuments) {
          resignation.exitDocuments = {};
        }
        if (files) {
          if (files.experienceLetter) {
            resignation.exitDocuments.experienceLetter = files.experienceLetter;
          }
          if (files.relievingLetter) {
            resignation.exitDocuments.relievingLetter = files.relievingLetter;
          }
          resignation.exitDocuments.uploadedAt = new Date();
        }
        resignation.markModified('exitDocuments');
        break;

      case 'systemAccessDeactivated':
        resignation.systemAccessDeactivated = value === true;
        if (value === true) {
          resignation.systemAccessDeactivatedDate = date ? new Date(date) : new Date();
        }
        resignation.markModified('systemAccessDeactivated');
        resignation.markModified('systemAccessDeactivatedDate');
        break;

      case 'exitClosed':
        resignation.exitClosed = value === true;
        if (value === true) {
          resignation.exitClosedDate = date ? new Date(date) : new Date();
          resignation.exitClosedBy = userId;
        }
        resignation.markModified('exitClosed');
        resignation.markModified('exitClosedDate');
        resignation.markModified('exitClosedBy');
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid field' },
          { status: 400 }
        );
    }

    console.log('=== BEFORE SAVE ===');
    console.log('Field being updated:', field);
    if (field === 'clearance') {
      console.log('Clearances object:', JSON.stringify(resignation.clearances, null, 2));
      console.log('Is clearances modified?', resignation.isModified('clearances'));
    }
    
    await resignation.save({ validateBeforeSave: true });
    
    console.log('=== AFTER SAVE ===');
    if (field === 'clearance') {
      console.log('Clearances after save:', JSON.stringify(resignation.clearances, null, 2));
    }
    
    // Reload the document to ensure we have the latest data
    const updatedResignation = await Resignation.findById(params.id)
      .populate('userId', 'name email profileImage empId designation')
      .populate('approvedBy', 'name email')
      .populate('exitClosedBy', 'name email')
      .lean();
    
    if (field === 'clearance') {
      console.log('Clearances from reloaded document:', JSON.stringify((updatedResignation as any)?.clearances, null, 2));
    }

    return NextResponse.json(
      { message: 'Exit process updated successfully', resignation: updatedResignation },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating exit process:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
