import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'leave_approved' | 'leave_rejected';
  title: string;
  message: string;
  leaveId?: mongoose.Types.ObjectId;
  dismissed: boolean;
  dismissedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['leave_approved', 'leave_rejected'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    leaveId: {
      type: Schema.Types.ObjectId,
      ref: 'Leave',
    },
    dismissed: {
      type: Boolean,
      default: false,
      index: true,
    },
    dismissedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
NotificationSchema.index({ userId: 1, dismissed: 1 });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;

