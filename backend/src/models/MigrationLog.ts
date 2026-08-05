import mongoose, { Schema } from 'mongoose';

type MigrationLogDocument = {
  _id: string;
  companyId: string;
  areaId: string;
  scopedWeekId: string;
  employeeId: string;
  employeeName: string;
  userIdentifier: string;
  groupKey: string;
  results: unknown[];
  overtimeResults?: unknown[];
  migratedBy: string | null;
  migratedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const MigrationLogSchema = new Schema<MigrationLogDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    scopedWeekId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    userIdentifier: { type: String, required: true },
    groupKey: { type: String, required: true },
    results: { type: [Schema.Types.Mixed], required: true },
    overtimeResults: { type: [Schema.Types.Mixed], default: [] },
    migratedBy: { type: String, default: null },
    migratedAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false, _id: false }
);

MigrationLogSchema.index({ companyId: 1, scopedWeekId: 1 });
MigrationLogSchema.index({ companyId: 1, scopedWeekId: 1, groupKey: 1 }, { unique: true });

export const MigrationLogModel = mongoose.model<MigrationLogDocument>('MigrationLog', MigrationLogSchema);
export type { MigrationLogDocument };
