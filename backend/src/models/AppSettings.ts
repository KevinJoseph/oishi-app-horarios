import mongoose, { Schema } from 'mongoose';

type AppSettingsDocument = {
  _id: string;
  currentAreaId: string;
  updatedAt: Date;
  createdAt: Date;
};

const AppSettingsSchema = new Schema<AppSettingsDocument>(
  {
    _id: { type: String, required: true },
    currentAreaId: { type: String, required: true, default: '' }
  },
  { timestamps: true, versionKey: false, _id: false }
);

export const AppSettingsModel = mongoose.model<AppSettingsDocument>('AppSettings', AppSettingsSchema);
export type { AppSettingsDocument };
