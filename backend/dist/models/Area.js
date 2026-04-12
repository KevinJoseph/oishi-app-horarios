import mongoose, { Schema } from 'mongoose';
const AreaSchema = new Schema({
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    label: { type: String, required: true },
    order: { type: Number, required: true, default: 0 }
}, { timestamps: true, versionKey: false, _id: false });
AreaSchema.index({ companyId: 1, code: 1 }, { unique: true });
export const AreaModel = mongoose.model('Area', AreaSchema);
