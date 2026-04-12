import { AreaModel } from '../models/Area.js';
import { HttpError } from '../utils/httpError.js';

export type AreaPayload = {
  code: string;
  label: string;
  order?: number;
};

export type AreaResponse = {
  id: string;
  companyId: string;
  code: string;
  label: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

function areaId(companyId: string, code: string): string {
  return `${companyId}::${code}`;
}

function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

function toResponse(doc: { _id: string; companyId: string; code: string; label: string; order: number; createdAt: Date; updatedAt: Date }): AreaResponse {
  return {
    id: doc._id,
    companyId: doc.companyId,
    code: doc.code,
    label: doc.label,
    order: doc.order,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

export async function listAreas(companyId: string): Promise<AreaResponse[]> {
  const docs = await AreaModel.find({ companyId }).sort({ order: 1, code: 1 }).lean();
  return docs.map(toResponse);
}

export async function createArea(companyId: string, payload: AreaPayload): Promise<AreaResponse> {
  const code = normalizeCode(payload.code ?? '');
  const label = (payload.label ?? '').trim();

  if (!code) throw new HttpError(400, 'El código del área es obligatorio.');
  if (!label) throw new HttpError(400, 'El nombre del área es obligatorio.');

  const existing = await AreaModel.findOne({ companyId, code }).lean();
  if (existing) throw new HttpError(409, `Ya existe un área con código "${code}" en esta empresa.`);

  const doc = await AreaModel.create({
    _id: areaId(companyId, code),
    companyId,
    code,
    label,
    order: payload.order ?? 0
  });

  return toResponse(doc);
}

export async function updateArea(companyId: string, areaCode: string, payload: Partial<AreaPayload>): Promise<AreaResponse> {
  const id = areaId(companyId, areaCode);
  const doc = await AreaModel.findById(id);
  if (!doc) throw new HttpError(404, 'Área no encontrada.');

  if (payload.label !== undefined) {
    const label = payload.label.trim();
    if (!label) throw new HttpError(400, 'El nombre del área es obligatorio.');
    doc.label = label;
  }
  if (payload.order !== undefined) {
    doc.order = payload.order;
  }

  await doc.save();
  return toResponse(doc);
}

export async function deleteArea(companyId: string, areaCode: string): Promise<void> {
  const id = areaId(companyId, areaCode);
  const doc = await AreaModel.findById(id);
  if (!doc) throw new HttpError(404, 'Área no encontrada.');
  await doc.deleteOne();
}

export async function getAreaCodesForCompany(companyId: string): Promise<string[]> {
  const docs = await AreaModel.find({ companyId }).sort({ order: 1, code: 1 }).lean();
  return docs.map((d) => d.code);
}
