import mongoose, { Schema } from 'mongoose';
const AreaSettingsSchema = new Schema({
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    timeSlots: { type: [Schema.Types.Mixed], required: true },
    shiftRanges: { type: Schema.Types.Mixed, required: true },
    validationRequirements: { type: Schema.Types.Mixed, required: true },
    breakConfig: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true, versionKey: false, _id: false });
AreaSettingsSchema.index({ companyId: 1, areaId: 1 }, { unique: true });
export const AreaSettingsModel = mongoose.model('AreaSettings', AreaSettingsSchema);
