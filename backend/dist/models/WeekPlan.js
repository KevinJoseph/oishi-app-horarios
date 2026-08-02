import mongoose, { Schema } from 'mongoose';
const WeekPlanSchema = new Schema({
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    baseWeekId: { type: String, required: true, index: true },
    days: { type: [Schema.Types.Mixed], required: true },
    restDayOverrides: { type: Schema.Types.Mixed }
}, { timestamps: true, versionKey: false, _id: false });
WeekPlanSchema.index({ companyId: 1, areaId: 1, baseWeekId: 1 }, { unique: true });
export const WeekPlanModel = mongoose.model('WeekPlan', WeekPlanSchema);
