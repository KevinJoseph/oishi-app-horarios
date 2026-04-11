import mongoose, { Schema } from 'mongoose';

export type PasswordResetTokenDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const PasswordResetTokenSchema = new Schema<PasswordResetTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const PasswordResetTokenModel = mongoose.model<PasswordResetTokenDocument>(
  'PasswordResetToken',
  PasswordResetTokenSchema
);
