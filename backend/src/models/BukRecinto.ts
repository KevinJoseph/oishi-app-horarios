import mongoose, { Schema } from 'mongoose';

/** Recinto de BUK asignado a una empresa (companyId de la configuración de empresas). */
type BukRecintoDocument = {
  _id: string;
  companyId: string;
  code: string;
  name: string;
  attendanceEnabled: boolean;
  updatedAt: Date;
  createdAt: Date;
};

const BukRecintoSchema = new Schema<BukRecintoDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    attendanceEnabled: { type: Boolean, required: true, default: true }
  },
  { timestamps: true, versionKey: false, _id: false }
);

export const BukRecintoModel = mongoose.model<BukRecintoDocument>('BukRecinto', BukRecintoSchema);
export type { BukRecintoDocument };
