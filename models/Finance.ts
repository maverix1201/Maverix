import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFinance extends Document {
  userId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  bonus?: number;
  totalSalary: number;
  status: 'pending' | 'paid';
  paidAt?: Date;
  payslipUrl?: string;
  panCardImage?: string;
  aadharCardImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FinanceSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    baseSalary: {
      type: Number,
      required: true,
    },
    allowances: {
      type: Number,
      default: 0,
    },
    deductions: {
      type: Number,
      default: 0,
    },
    bonus: {
      type: Number,
      default: 0,
    },
    totalSalary: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    paidAt: {
      type: Date,
    },
    payslipUrl: {
      type: String,
    },
    panCardImage: {
      type: String,
    },
    aadharCardImage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

FinanceSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

const Finance: Model<IFinance> =
  mongoose.models.Finance || mongoose.model<IFinance>('Finance', FinanceSchema);

export default Finance;

