import mongoose, { Schema } from 'mongoose';
const PlannerStateSchema = new Schema({
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
    weekAuditById: { type: Schema.Types.Mixed, required: true, default: {} }
}, {
    timestamps: true,
    versionKey: false
});
export const PlannerStateModel = mongoose.model('PlannerState', PlannerStateSchema);
