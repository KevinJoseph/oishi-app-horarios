import mongoose, { Schema } from 'mongoose';

type AreaSettingsDocument = {
  _id: string;
  companyId: string;
  areaId: string;
  timeSlots: unknown[];
  shiftRanges: Record<string, unknown>;
  validationRequirements: Record<string, unknown>;
  breakConfig: Record<string, unknown>;
  updatedAt: Date;
  createdAt: Date;
};

const AreaSettingsSchema = new Schema<AreaSettingsDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    timeSlots: { type: [Schema.Types.Mixed], required: true },
    shiftRanges: { type: Schema.Types.Mixed, required: true },
    validationRequirements: { type: Schema.Types.Mixed, required: true },
    breakConfig: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true, versionKey: false, _id: false }
);

AreaSettingsSchema.index({ companyId: 1, areaId: 1 }, { unique: true });

export const AreaSettingsModel = mongoose.model<AreaSettingsDocument>('AreaSettings', AreaSettingsSchema);
export type { AreaSettingsDocument };
