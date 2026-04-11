import mongoose, { Schema } from 'mongoose';
import type { UserRole } from '../types/auth.js';

export type UserDocument = {
  _id: mongoose.Types.ObjectId;
  username: string;
  name: string;
  celular: string | null;
  role: UserRole;
  companyId: string | null;
  passwordHash: string;
  passwordSalt: string;
  createdAt: Date;
  updatedAt: Date;
};

const UserSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    celular: { type: String, default: null, trim: true },
    role: { type: String, required: true, enum: ['super_administrador', 'administrador', 'supervisor'] },
    companyId: { type: String, default: null, trim: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const UserModel = mongoose.model<UserDocument>('User', UserSchema);
