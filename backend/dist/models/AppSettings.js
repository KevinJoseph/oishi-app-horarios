import mongoose, { Schema } from 'mongoose';
const AppSettingsSchema = new Schema({
    _id: { type: String, required: true },
    currentAreaId: { type: String, required: true, default: '' }
}, { timestamps: true, versionKey: false, _id: false });
export const AppSettingsModel = mongoose.model('AppSettings', AppSettingsSchema);
