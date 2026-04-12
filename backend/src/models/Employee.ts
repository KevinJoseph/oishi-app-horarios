import mongoose, { Schema } from 'mongoose';

type EmployeeDocument = {
  _id: string;
  data: Record<string, unknown>;
  updatedAt: Date;
  createdAt: Date;
};

const EmployeeSchema = new Schema<EmployeeDocument>(
  {
    _id: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true, versionKey: false, _id: false }
);

export const EmployeeModel = mongoose.model<EmployeeDocument>('Employee', EmployeeSchema);
export type { EmployeeDocument };
