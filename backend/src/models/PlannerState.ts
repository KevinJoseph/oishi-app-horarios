import mongoose, { Schema } from 'mongoose';
type PlannerStateDocument = {
  key: string;
  employees: unknown[];
  roles: unknown[];
  timeSlots: unknown[];
  weeks: unknown[];
  weekPlans: Record<string, unknown>;
  updatedAt: Date;
  createdAt: Date;
};

const PlannerStateSchema = new Schema<PlannerStateDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    employees: { type: [Schema.Types.Mixed], required: true },
    roles: { type: [Schema.Types.Mixed], required: true },
    timeSlots: { type: [Schema.Types.Mixed], required: true },
    weeks: { type: [Schema.Types.Mixed], required: true },
    weekPlans: { type: Schema.Types.Mixed, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const PlannerStateModel = mongoose.model<PlannerStateDocument>('PlannerState', PlannerStateSchema);

export type { PlannerStateDocument };
