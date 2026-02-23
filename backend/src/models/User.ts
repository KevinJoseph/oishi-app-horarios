import mongoose, { Schema } from 'mongoose';
import type { UserRole } from '../types/auth.js';

export type UserDocument = {
  _id: mongoose.Types.ObjectId;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  passwordSalt: string;
  createdAt: Date;
  updatedAt: Date;
};

const UserSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ['administrador', 'lector'] },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const UserModel = mongoose.model<UserDocument>('User', UserSchema);
