import mongoose, { Schema } from 'mongoose';
const EmployeeSchema = new Schema({
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    baseEmployeeId: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true, versionKey: false, _id: false });
EmployeeSchema.index({ companyId: 1, baseEmployeeId: 1 }, { unique: true });
export const EmployeeModel = mongoose.model('Employee', EmployeeSchema);
