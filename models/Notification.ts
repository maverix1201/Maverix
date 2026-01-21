import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'leave_approved' | 'leave_rejected' | 'mention';
  title: string;
  message: string;
  leaveId?: mongoose.Types.ObjectId;
  feedId?: mongoose.Types.ObjectId;
  mentionedBy?: mongoose.Types.ObjectId;
  dismissed: boolean;
  dismissedAt?: Date;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['leave_approved', 'leave_rejected', 'mention'],
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
    feedId: {
      type: Schema.Types.ObjectId,
      ref: 'Feed',
    },
    mentionedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    dismissed: {
      type: Boolean,
      default: false,
      index: true,
    },
    dismissedAt: {
      type: Date,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
NotificationSchema.index({ userId: 1, dismissed: 1 });
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;

