import mongoose, { Schema } from 'mongoose';
const SessionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, {
    timestamps: true,
    versionKey: false
});
export const SessionModel = mongoose.model('Session', SessionSchema);
