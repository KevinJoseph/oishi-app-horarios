import mongoose, { Schema } from 'mongoose';
const WeekConfigSchema = new Schema({
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    baseWeekId: { type: String, required: true, index: true },
    timeSlots: { type: [Schema.Types.Mixed], required: true },
    shiftRanges: { type: Schema.Types.Mixed, required: true },
    validationRequirements: { type: Schema.Types.Mixed, required: true },
    breakConfig: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true, versionKey: false, _id: false });
WeekConfigSchema.index({ companyId: 1, areaId: 1, baseWeekId: 1 }, { unique: true });
export const WeekConfigModel = mongoose.model('WeekConfig', WeekConfigSchema);
