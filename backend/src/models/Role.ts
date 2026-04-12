import mongoose, { Schema } from 'mongoose';

type RoleDocument = {
  _id: string;
  companyId: string;
  areaId: string;
  data: Record<string, unknown>;
  updatedAt: Date;
  createdAt: Date;
};

const RoleSchema = new Schema<RoleDocument>(
  {
    _id: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    areaId: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true, versionKey: false, _id: false }
);

RoleSchema.index({ companyId: 1, areaId: 1 });

export const RoleModel = mongoose.model<RoleDocument>('Role', RoleSchema);
export type { RoleDocument };
