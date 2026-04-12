import mongoose, { Schema } from 'mongoose';

type WeekDocument = {
  _id: string;
  label: string;
  startDateISO: string;
  updatedAt: Date;
  createdAt: Date;
};

const WeekSchema = new Schema<WeekDocument>(
  {
    _id: { type: String, required: true },
    label: { type: String, required: true },
    startDateISO: { type: String, required: true, index: true }
  },
  { timestamps: true, versionKey: false, _id: false }
);

export const WeekModel = mongoose.model<WeekDocument>('Week', WeekSchema);
export type { WeekDocument };
