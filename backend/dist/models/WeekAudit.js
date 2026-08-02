import mongoose, { Schema } from 'mongoose';
const WeekAuditSchema = new Schema({
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    baseWeekId: { type: String, required: true, index: true },
    createdByName: { type: String, default: null },
    validatedByName: { type: String, default: null },
    validated: { type: Boolean, required: true, default: false, index: true },
    inactiveEmployeeIds: { type: [String], default: undefined }
}, { timestamps: true, versionKey: false, _id: false });
WeekAuditSchema.index({ companyId: 1, areaId: 1, baseWeekId: 1 }, { unique: true });
export const WeekAuditModel = mongoose.model('WeekAudit', WeekAuditSchema);
