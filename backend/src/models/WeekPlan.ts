import mongoose, { Schema } from 'mongoose';

type WeekPlanDocument = {
  _id: string;
  companyId: string;
  areaId: string;
  baseWeekId: string;
  days: unknown[];
  restDayOverrides?: Record<string, number[]>;
  updatedAt: Date;
  createdAt: Date;
};

const WeekPlanSchema = new Schema<WeekPlanDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    baseWeekId: { type: String, required: true, index: true },
    days: { type: [Schema.Types.Mixed], required: true },
    restDayOverrides: { type: Schema.Types.Mixed }
  },
  { timestamps: true, versionKey: false, _id: false }
);

WeekPlanSchema.index({ companyId: 1, areaId: 1, baseWeekId: 1 }, { unique: true });

export const WeekPlanModel = mongoose.model<WeekPlanDocument>('WeekPlan', WeekPlanSchema);
export type { WeekPlanDocument };
