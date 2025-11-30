import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAnnouncement extends Document {
  title: string;
  content: string;
  date: Date;
  createdBy: mongoose.Types.ObjectId;
  views: Array<{
    userId: mongoose.Types.ObjectId;
    viewCount: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      maxlength: 5000,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    views: {
      type: [
        {
          userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
          viewCount: {
            type: Number,
            default: 0,
            min: 0,
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

AnnouncementSchema.index({ createdAt: -1 });
AnnouncementSchema.index({ createdBy: 1 });
AnnouncementSchema.index({ 'views.userId': 1 });

const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement || mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);

export default Announcement;

