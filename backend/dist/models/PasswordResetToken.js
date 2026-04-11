import mongoose, { Schema } from 'mongoose';
const PasswordResetTokenSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null }
}, {
    timestamps: true,
    versionKey: false
});
export const PasswordResetTokenModel = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
