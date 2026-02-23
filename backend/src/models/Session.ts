import mongoose, { Schema } from 'mongoose';

export type SessionDocument = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const SessionSchema = new Schema<SessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const SessionModel = mongoose.model<SessionDocument>('Session', SessionSchema);
