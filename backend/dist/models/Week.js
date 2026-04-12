import mongoose, { Schema } from 'mongoose';
const WeekSchema = new Schema({
    _id: { type: String, required: true },
    label: { type: String, required: true },
    startDateISO: { type: String, required: true, index: true }
}, { timestamps: true, versionKey: false, _id: false });
export const WeekModel = mongoose.model('Week', WeekSchema);
