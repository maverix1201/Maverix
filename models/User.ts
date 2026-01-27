import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'hr' | 'employee';
  empId?: string; // Employee ID (e.g., "2024EMP-001")
  designation?: string;
  profileImage?: string;
  mobileNumber?: string;
  dateOfBirth?: Date;
  joiningYear?: number; // Year when employee joined (e.g., 2024)
  joiningYearUpdatedAt?: Date; // When joiningYear was first set (used for global empId ordering)
  emailVerified: boolean;
  approved: boolean;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordTokenExpiry?: Date;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panCardImage?: string;
  aadharCardImage?: string;
  location?: string;
  panNumber?: string;
  aadharNumber?: string;
  weeklyOff?: string[]; // Array of day names like ['Sunday', 'Monday']
  clockInTime?: string; // Individual clock-in time limit (HH:mm format, e.g., "09:30")
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ['admin', 'hr', 'employee'],
      default: 'employee',
    },
    empId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    joiningYear: {
      type: Number,
      min: 1900,
      max: 2100,
    },
    joiningYearUpdatedAt: {
      type: Date,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    approved: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
    verificationTokenExpiry: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordTokenExpiry: {
      type: Date,
    },
    bankName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    panCardImage: {
      type: String,
    },
    aadharCardImage: {
      type: String,
    },
    location: {
      type: String,
      trim: true,
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    aadharNumber: {
      type: String,
      trim: true,
    },
    weeklyOff: {
      type: [String],
      default: [],
      validate: {
        validator: function(v: string[]) {
          const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          return v.every(day => validDays.includes(day));
        },
        message: 'Weekly off must be valid day names',
      },
    },
    clockInTime: {
      type: String,
      validate: {
        validator: function(v: any) {
          // Allow undefined, null, or empty string (optional field)
          if (v === undefined || v === null || v === '') {
            return true;
          }
          // Convert to string and trim to handle any edge cases
          const value = String(v).trim();
          // Allow "N/R" as special marker for no restrictions (case-insensitive check)
          if (value === 'N/R' || value.toUpperCase() === 'N/R') {
            return true;
          }
          // Validate HH:mm format
          const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
          return timeRegex.test(value);
        },
        message: 'Clock-in time must be in HH:mm format (e.g., 09:30) or "N/R" for no restrictions',
      },
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;

