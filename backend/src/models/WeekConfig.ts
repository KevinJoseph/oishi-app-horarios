import mongoose, { Schema } from 'mongoose';

type WeekConfigDocument = {
  _id: string;
  companyId: string;
  areaId: string;
  baseWeekId: string;
  timeSlots: unknown[];
  shiftRanges: Record<string, unknown>;
  validationRequirements: Record<string, unknown>;
  breakConfig: Record<string, unknown>;
  updatedAt: Date;
  createdAt: Date;
};

const WeekConfigSchema = new Schema<WeekConfigDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    baseWeekId: { type: String, required: true, index: true },
    timeSlots: { type: [Schema.Types.Mixed], required: true },
    shiftRanges: { type: Schema.Types.Mixed, required: true },
    validationRequirements: { type: Schema.Types.Mixed, required: true },
    breakConfig: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true, versionKey: false, _id: false }
);

WeekConfigSchema.index({ companyId: 1, areaId: 1, baseWeekId: 1 }, { unique: true });

export const WeekConfigModel = mongoose.model<WeekConfigDocument>('WeekConfig', WeekConfigSchema);
export type { WeekConfigDocument };
