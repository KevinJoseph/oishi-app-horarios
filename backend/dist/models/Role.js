import mongoose, { Schema } from 'mongoose';
const RoleSchema = new Schema({
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true, versionKey: false, _id: false });
RoleSchema.index({ companyId: 1, areaId: 1 });
export const RoleModel = mongoose.model('Role', RoleSchema);
