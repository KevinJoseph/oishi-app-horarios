import mongoose, { Schema } from 'mongoose';

type WeekDocument = {
  _id: string;
  companyId: string;
  baseWeekId: string;
  label: string;
  startDateISO: string;
  updatedAt: Date;
  createdAt: Date;
};

const WeekSchema = new Schema<WeekDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    baseWeekId: { type: String, required: true },
    label: { type: String, required: true },
    startDateISO: { type: String, required: true, index: true }
  },
  { timestamps: true, versionKey: false, _id: false }
);

WeekSchema.index({ companyId: 1, baseWeekId: 1 }, { unique: true });

export const WeekModel = mongoose.model<WeekDocument>('Week', WeekSchema);
export type { WeekDocument };
