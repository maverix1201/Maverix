import mongoose, { Schema, Document, Model } from 'mongoose';
// Import LeaveType to ensure it's registered before Leave model uses it
import '@/models/LeaveType';

export interface ILeave extends Document {
  userId: mongoose.Types.ObjectId;
  leaveType: mongoose.Types.ObjectId; // Reference to LeaveType
  days: number; // Number of days (0.5 for half-day, less than 1 for short-day)
  remainingDays?: number; // Remaining days for allotted leaves (deducted when approved)
  hours?: number; // Hours for shortday leave (e.g., 28 for 28 hours)
  minutes?: number; // Minutes for shortday leave (e.g., 30 for 30 minutes)
  remainingHours?: number; // Remaining hours for allotted shortday leaves
  remainingMinutes?: number; // Remaining minutes for allotted shortday leaves
  carryForward?: boolean; // Whether this leave is carried forward from previous year
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  halfDayType?: 'first-half' | 'second-half'; // For half-day leaves
  shortDayTime?: string; // For short-day leaves (time range in format "HH:MM-HH:MM" or "HH:MM" for backward compatibility)
  medicalReport?: string; // URL or file path for medical report (for medical leave)
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  allottedBy?: mongoose.Types.ObjectId; // Admin/HR who allotted this leave
  allottedAt?: Date; // When the leave was allotted
  createdAt: Date;
  updatedAt: Date;
}

const LeaveSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    leaveType: {
      type: Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: true,
    },
    days: {
      type: Number,
      required: true,
      validate: {
        validator: function(value: number) {
          // Allow 0 if hours/minutes are present (shortday leave types)
          if (value === 0) {
            return (this as any).hours !== undefined || (this as any).minutes !== undefined;
          }
          // For regular leaves, require at least 0.1
          return value >= 0.1;
        },
        message: 'Days must be at least 0.1 for regular leaves, or 0 is allowed only when hours/minutes are present for shortday leaves'
      }
    },
    halfDayType: {
      type: String,
      enum: ['first-half', 'second-half'],
    },
    shortDayTime: {
      type: String, // Store time in HH:MM format (e.g., "09:30", "14:00")
    },
    medicalReport: {
      type: String, // URL or file path for medical report
    },
    remainingDays: {
      type: Number,
      min: 0,
    },
    hours: {
      type: Number,
      min: 0,
    },
    minutes: {
      type: Number,
      min: 0,
      max: 59,
    },
    remainingHours: {
      type: Number,
      min: 0,
    },
    remainingMinutes: {
      type: Number,
      min: 0,
      max: 59,
    },
    carryForward: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
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
    rejectionReason: {
      type: String,
    },
    allottedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    allottedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Performance optimization: Add indexes for common query patterns
LeaveSchema.index({ userId: 1, leaveType: 1, allottedBy: 1 }); // For checking existing allotted leaves
LeaveSchema.index({ userId: 1, leaveType: 1, status: 1 }); // For fetching user leaves by type and status
LeaveSchema.index({ userId: 1, status: 1 }); // For fetching all user leaves by status
LeaveSchema.index({ allottedBy: 1 }); // For fetching all allotted leaves
LeaveSchema.index({ createdAt: -1 }); // For sorting by creation date

// Force recompilation of the model to ensure schema changes take effect
// This is necessary when changing from enum to ObjectId reference
let Leave: Model<ILeave>;
if (mongoose.models.Leave) {
  // Delete the old model to force recompilation with new schema
  delete mongoose.models.Leave;
  // Only delete from modelSchemas if it exists
  if ((mongoose as any).modelSchemas && (mongoose as any).modelSchemas.Leave) {
    delete (mongoose as any).modelSchemas.Leave;
  }
}
Leave = mongoose.model<ILeave>('Leave', LeaveSchema);

export default Leave;

