import mongoose, { Schema } from 'mongoose';

/**
 * Turno ya exportado a BUK. `_id` es la firma del horario (prefijo de área + inicio-fin):
 * una vez creado, el código no cambia y se reutiliza en cualquier semana.
 */
type BukShiftDocument = {
  _id: string;
  code: string;
  name: string;
  areaLabel: string;
  start: string;
  end: string;
  nocturnal: boolean;
  /** Recintos BUK en los que ya se exportó el turno. */
  recintoCodes: string[];
  updatedAt: Date;
  createdAt: Date;
};

const BukShiftSchema = new Schema<BukShiftDocument>(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    areaLabel: { type: String, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    nocturnal: { type: Boolean, required: true },
    recintoCodes: { type: [String], required: true, default: [] }
  },
  { timestamps: true, versionKey: false, _id: false }
);

export const BukShiftModel = mongoose.model<BukShiftDocument>('BukShift', BukShiftSchema);
export type { BukShiftDocument };
