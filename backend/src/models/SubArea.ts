import mongoose, { Schema } from 'mongoose';

// Sub-áreas: solo organizativas. NO se usan en planificación de horarios
// (plannerState.service no las lee).
type SubAreaDocument = {
  _id: string;
  companyId: string;
  areaCode: string;
  code: string;
  label: string;
  order: number;
  updatedAt: Date;
  createdAt: Date;
};

const SubAreaSchema = new Schema<SubAreaDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaCode: { type: String, required: true },
    code: { type: String, required: true },
    label: { type: String, required: true },
    order: { type: Number, required: true, default: 0 }
  },
  { timestamps: true, versionKey: false, _id: false }
);

SubAreaSchema.index({ companyId: 1, areaCode: 1, code: 1 }, { unique: true });

export const SubAreaModel = mongoose.model<SubAreaDocument>('SubArea', SubAreaSchema);
export type { SubAreaDocument };
