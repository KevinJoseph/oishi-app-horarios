import mongoose, { Schema } from 'mongoose';
type PlannerStateDocument = {
  key: string;
  employees: unknown[];
  roles: unknown[];
  currentAreaId: string;
  timeSlots: unknown[];
  shiftRanges: unknown;
  validationRequirements: unknown;
  timeSlotsByArea: unknown;
  shiftRangesByArea: unknown;
  validationRequirementsByArea: unknown;
  breakConfig: unknown;
  breakConfigByArea: unknown;
  weeks: unknown[];
  weekPlans: Record<string, unknown>;
  validatedWeekIds: string[];
  weekAuditById: Record<string, unknown>;
  weekConfigById: Record<string, unknown>;
  updatedAt: Date;
  createdAt: Date;
};

const PlannerStateSchema = new Schema<PlannerStateDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    employees: { type: [Schema.Types.Mixed], required: true },
    roles: { type: [Schema.Types.Mixed], required: true },
    currentAreaId: { type: String, required: true, default: 'salon' },
    timeSlots: { type: [Schema.Types.Mixed], required: true },
    shiftRanges: { type: Schema.Types.Mixed, required: true },
    validationRequirements: { type: Schema.Types.Mixed, required: true },
    timeSlotsByArea: { type: Schema.Types.Mixed, required: true, default: {} },
    shiftRangesByArea: { type: Schema.Types.Mixed, required: true, default: {} },
    validationRequirementsByArea: { type: Schema.Types.Mixed, required: true, default: {} },
    breakConfig: { type: Schema.Types.Mixed, required: true, default: {} },
    breakConfigByArea: { type: Schema.Types.Mixed, required: true, default: {} },
    weeks: { type: [Schema.Types.Mixed], required: true },
    weekPlans: { type: Schema.Types.Mixed, required: true },
    validatedWeekIds: { type: [String], required: true, default: [] },
    weekAuditById: { type: Schema.Types.Mixed, required: true, default: {} },
    weekConfigById: { type: Schema.Types.Mixed, required: true, default: {} }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const PlannerStateModel = mongoose.model<PlannerStateDocument>('PlannerState', PlannerStateSchema);

export type { PlannerStateDocument };
