import mongoose, { Schema } from 'mongoose';

type WeekAuditDocument = {
  _id: string;
  companyId: string;
  areaId: string;
  baseWeekId: string;
  createdByName: string | null;
  validatedByName: string | null;
  validated: boolean;
  inactiveEmployeeIds?: string[];
  updatedAt: Date;
  createdAt: Date;
};

const WeekAuditSchema = new Schema<WeekAuditDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    baseWeekId: { type: String, required: true, index: true },
    createdByName: { type: String, default: null },
    validatedByName: { type: String, default: null },
    validated: { type: Boolean, required: true, default: false, index: true },
    inactiveEmployeeIds: { type: [String], default: undefined }
  },
  { timestamps: true, versionKey: false, _id: false }
);

WeekAuditSchema.index({ companyId: 1, areaId: 1, baseWeekId: 1 }, { unique: true });

export const WeekAuditModel = mongoose.model<WeekAuditDocument>('WeekAudit', WeekAuditSchema);
export type { WeekAuditDocument };
