import mongoose, { Schema } from 'mongoose';
const UserSchema = new Schema({
    username: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    celular: { type: String, default: null, trim: true },
    role: { type: String, required: true, enum: ['super_administrador', 'administrador', 'supervisor'] },
    companyId: { type: String, default: null, trim: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true }
}, {
    timestamps: true,
    versionKey: false
});
export const UserModel = mongoose.model('User', UserSchema);
