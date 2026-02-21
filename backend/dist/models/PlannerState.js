import mongoose, { Schema } from 'mongoose';
const PlannerStateSchema = new Schema({
    key: { type: String, required: true, unique: true, index: true },
    employees: { type: [Schema.Types.Mixed], required: true },
    roles: { type: [Schema.Types.Mixed], required: true },
    timeSlots: { type: [Schema.Types.Mixed], required: true },
    shiftRanges: { type: Schema.Types.Mixed, required: true },
    validationRequirements: { type: Schema.Types.Mixed, required: true },
    weeks: { type: [Schema.Types.Mixed], required: true },
    weekPlans: { type: Schema.Types.Mixed, required: true }
}, {
    timestamps: true,
    versionKey: false
});
export const PlannerStateModel = mongoose.model('PlannerState', PlannerStateSchema);
