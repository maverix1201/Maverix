import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScheduledEmail extends Document {
  userIds: mongoose.Types.ObjectId[];
  subject: string;
  html: string;
  scheduledFor?: Date; // Optional - if not set, it's an immediate send
  sent: boolean;
  sentAt?: Date;
  openedBy: mongoose.Types.ObjectId[]; // Track which recipients opened the email
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledEmailSchema: Schema = new Schema(
  {
    userIds: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    html: {
      type: String,
      required: true,
    },
    scheduledFor: {
      type: Date,
      required: false, // Optional - immediate sends don't have this
      index: true,
    },
    sent: {
      type: Boolean,
      default: false,
      index: true,
    },
    sentAt: {
      type: Date,
    },
    openedBy: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    strictPopulate: false, // Allow populating paths that might not be in schema (for backward compatibility)
  }
);

// Index for efficient querying of unsent scheduled emails
ScheduledEmailSchema.index({ sent: 1, scheduledFor: 1 });

// Force recompilation of the model to ensure schema changes take effect
let ScheduledEmail: Model<IScheduledEmail>;
if (mongoose.models.ScheduledEmail) {
  // Delete the old model to force recompilation with new schema
  delete mongoose.models.ScheduledEmail;
  // Only delete from modelSchemas if it exists
  if ((mongoose as any).modelSchemas && (mongoose as any).modelSchemas.ScheduledEmail) {
    delete (mongoose as any).modelSchemas.ScheduledEmail;
  }
}
ScheduledEmail = mongoose.model<IScheduledEmail>('ScheduledEmail', ScheduledEmailSchema);

export default ScheduledEmail;

