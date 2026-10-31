import { BukShiftModel } from '../models/BukShift.js';
import { HttpError } from '../utils/httpError.js';

export type BukShiftPayload = {
  signature: string;
  code: string;
  name: string;
  areaLabel: string;
  start: string;
  end: string;
  nocturnal: boolean;
  recintoCodes: string[];
};

export type BukShiftResponse = BukShiftPayload & {
  createdAt: string;
  updatedAt: string;
};

const TIME_PATTERN = /^\d{2}:\d{2}$/;

function toResponse(doc: {
  _id: string;
  code: string;
  name: string;
  areaLabel: string;
  start: string;
  end: string;
  nocturnal: boolean;
  recintoCodes: string[];
  createdAt: Date;
  updatedAt: Date;
}): BukShiftResponse {
  return {
    signature: doc._id,
    code: doc.code,
    name: doc.name,
    areaLabel: doc.areaLabel,
    start: doc.start,
    end: doc.end,
    nocturnal: doc.nocturnal,
    recintoCodes: doc.recintoCodes,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

export async function listBukShifts(): Promise<BukShiftResponse[]> {
  const docs = await BukShiftModel.find().sort({ code: 1 }).lean();
  return docs.map(toResponse);
}

function normalizePayload(raw: Partial<BukShiftPayload>): BukShiftPayload {
  const shift: BukShiftPayload = {
    signature: String(raw?.signature ?? '').trim(),
    code: String(raw?.code ?? '').trim().toUpperCase(),
    name: String(raw?.name ?? '').trim(),
    areaLabel: String(raw?.areaLabel ?? '').trim(),
    start: String(raw?.start ?? '').trim(),
    end: String(raw?.end ?? '').trim(),
    nocturnal: Boolean(raw?.nocturnal),
    recintoCodes: Array.isArray(raw?.recintoCodes)
      ? raw.recintoCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean)
      : []
  };
  if (!shift.signature || !shift.code || !shift.name || !TIME_PATTERN.test(shift.start) || !TIME_PATTERN.test(shift.end)) {
    throw new HttpError(400, `Turno inválido: ${shift.code || shift.signature || '(sin código)'}.`);
  }
  return shift;
}

/**
 * Registra los turnos exportados. Un turno ya registrado conserva su código y nombre;
 * solo se le agregan los recintos nuevos.
 */
export async function registerBukShifts(rawShifts: unknown): Promise<BukShiftResponse[]> {
  if (!Array.isArray(rawShifts) || rawShifts.length === 0) {
    throw new HttpError(400, 'No hay turnos para registrar.');
  }
  const shifts = rawShifts.map((raw) => normalizePayload(raw as Partial<BukShiftPayload>));

  const existing = await BukShiftModel.find({
    $or: [{ _id: { $in: shifts.map((shift) => shift.signature) } }, { code: { $in: shifts.map((shift) => shift.code) } }]
  }).lean();
  const existingById = new Map(existing.map((doc) => [doc._id, doc]));
  for (const shift of shifts) {
    const owner = existing.find((doc) => doc.code === shift.code);
    if (owner && owner._id !== shift.signature) {
      throw new HttpError(409, `El código ${shift.code} ya pertenece a otro turno. Recarga la página.`);
    }
  }

  await BukShiftModel.bulkWrite(
    shifts.map((shift) =>
      existingById.has(shift.signature)
        ? {
            updateOne: {
              filter: { _id: shift.signature },
              update: { $addToSet: { recintoCodes: { $each: shift.recintoCodes } } }
            }
          }
        : {
            insertOne: {
              document: {
                _id: shift.signature,
                code: shift.code,
                name: shift.name,
                areaLabel: shift.areaLabel,
                start: shift.start,
                end: shift.end,
                nocturnal: shift.nocturnal,
                recintoCodes: Array.from(new Set(shift.recintoCodes))
              }
            }
          }
    )
  );

  return listBukShifts();
}
