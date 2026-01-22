import mongoose, { Schema, Document } from 'mongoose';

export interface IResignation extends Document {
  userId: mongoose.Types.ObjectId;
  resignationDate: Date; // Last working day / Date of resignation
  reason: string; // Reason for resignation
  feedback?: string; // Optional feedback
  assets?: string[]; // Company assets in possession
  
  // Notice Period
  noticePeriodStartDate?: Date;
  noticePeriodEndDate?: Date;
  noticePeriodComplied?: boolean;
  
  // Knowledge Transfer & Handover
  knowledgeTransferCompleted?: boolean;
  handoverNotes?: string;
  handoverCompletedDate?: Date;
  
  // Company Asset Return
  assetsReturned?: boolean;
  assetsReturnDate?: Date;
  assetsReturnNotes?: string;
  
  // Department Clearances
  clearances?: {
    design?: {
      status: 'pending' | 'approved' | 'rejected';
      approvedBy?: mongoose.Types.ObjectId;
      approvedAt?: Date;
      notes?: string;
    };
    operation?: {
      status: 'pending' | 'approved' | 'rejected';
      approvedBy?: mongoose.Types.ObjectId;
      approvedAt?: Date;
      notes?: string;
    };
  };
  
  // Exit Interview
  exitInterviewCompleted?: boolean;
  exitInterviewDate?: Date;
  exitInterviewFeedback?: string;
  
  // Full & Final Settlement
  fnfStatus?: 'pending' | 'processing' | 'completed';
  fnfAmount?: number;
  fnfProcessedDate?: Date;
  fnfNotes?: string;
  
  // Exit Documents
  exitDocuments?: {
    experienceLetter?: string; // URL or file path
    relievingLetter?: string;
    otherDocuments?: string[];
    uploadedAt?: Date;
  };
  
  // System Access Deactivation
  systemAccessDeactivated?: boolean;
  systemAccessDeactivatedDate?: Date;
  
  // Exit Closure
  exitClosed?: boolean;
  exitClosedDate?: Date;
  exitClosedBy?: mongoose.Types.ObjectId;
  
  // Original fields
  status: 'pending' | 'approved' | 'rejected' | 'in-progress' | 'completed';
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ResignationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resignationDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    feedback: {
      type: String,
      trim: true,
    },
    assets: {
      type: [String],
      default: [],
      required: false,
    },
    
    // Notice Period
    noticePeriodStartDate: {
      type: Date,
    },
    noticePeriodEndDate: {
      type: Date,
    },
    noticePeriodComplied: {
      type: Boolean,
      default: false,
    },
    
    // Knowledge Transfer & Handover
    knowledgeTransferCompleted: {
      type: Boolean,
      default: false,
    },
    handoverNotes: {
      type: String,
      trim: true,
    },
    handoverCompletedDate: {
      type: Date,
    },
    
    // Company Asset Return
    assetsReturned: {
      type: Boolean,
      default: false,
    },
    assetsReturnDate: {
      type: Date,
    },
    assetsReturnNotes: {
      type: String,
      trim: true,
    },
    
    // Department Clearances
    clearances: {
      design: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        approvedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        approvedAt: {
          type: Date,
        },
        notes: {
          type: String,
          trim: true,
        },
      },
      operation: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        approvedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        approvedAt: {
          type: Date,
        },
        notes: {
          type: String,
          trim: true,
        },
      },
    },
    
    // Exit Interview
    exitInterviewCompleted: {
      type: Boolean,
      default: false,
    },
    exitInterviewDate: {
      type: Date,
    },
    exitInterviewFeedback: {
      type: String,
      trim: true,
    },
    
    // Full & Final Settlement
    fnfStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed'],
      default: 'pending',
    },
    fnfAmount: {
      type: Number,
    },
    fnfProcessedDate: {
      type: Date,
    },
    fnfNotes: {
      type: String,
      trim: true,
    },
    
    // Exit Documents
    exitDocuments: {
      experienceLetter: {
        type: String,
      },
      relievingLetter: {
        type: String,
      },
      otherDocuments: {
        type: [String],
        default: [],
      },
      uploadedAt: {
        type: Date,
      },
    },
    
    // System Access Deactivation
    systemAccessDeactivated: {
      type: Boolean,
      default: false,
    },
    systemAccessDeactivatedDate: {
      type: Date,
    },
    
    // Exit Closure
    exitClosed: {
      type: Boolean,
      default: false,
    },
    exitClosedDate: {
      type: Date,
    },
    exitClosedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    
    // Original status fields
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'in-progress', 'completed'],
      default: 'pending',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const Resignation = mongoose.models.Resignation || mongoose.model<IResignation>('Resignation', ResignationSchema);

export default Resignation;
