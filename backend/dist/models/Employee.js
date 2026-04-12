import mongoose, { Schema } from 'mongoose';
const EmployeeSchema = new Schema({
    _id: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true, versionKey: false, _id: false });
export const EmployeeModel = mongoose.model('Employee', EmployeeSchema);
