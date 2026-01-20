import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICounter extends Document {
  _id: string; // counter name
  seq: number;
}

const CounterSchema: Schema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);

export default Counter;

