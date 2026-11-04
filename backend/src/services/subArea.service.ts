import { AreaModel } from '../models/Area.js';
import { SubAreaModel } from '../models/SubArea.js';
import { HttpError } from '../utils/httpError.js';

export type SubAreaPayload = {
  label: string;
  order?: number;
};

export type SubAreaResponse = {
  id: string;
  companyId: string;
  areaCode: string;
  code: string;
  label: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

function subAreaId(companyId: string, areaCode: string, code: string): string {
  return `${companyId}::${areaCode}::${code}`;
}

function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

function toResponse(doc: {
  _id: string;
  companyId: string;
  areaCode: string;
  code: string;
  label: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}): SubAreaResponse {
  return {
    id: doc._id,
    companyId: doc.companyId,
    areaCode: doc.areaCode,
    code: doc.code,
    label: doc.label,
    order: doc.order,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

async function assertAreaExists(companyId: string, areaCode: string): Promise<void> {
  const area = await AreaModel.findOne({ companyId, code: areaCode }).lean();
  if (!area) throw new HttpError(404, 'Área no encontrada.');
}

export async function listSubAreas(companyId: string, areaCode?: string): Promise<SubAreaResponse[]> {
  const filter: Record<string, string> = { companyId };
  if (areaCode) filter.areaCode = areaCode;
  const docs = await SubAreaModel.find(filter).sort({ areaCode: 1, order: 1, code: 1 }).lean();
  return docs.map(toResponse);
}

export async function createSubArea(companyId: string, areaCode: string, payload: SubAreaPayload): Promise<SubAreaResponse> {
  await assertAreaExists(companyId, areaCode);
  const label = (payload.label ?? '').trim();
  if (!label) throw new HttpError(400, 'El nombre de la sub-área es obligatorio.');
  const code = normalizeCode(label);

  const existing = await SubAreaModel.findOne({ companyId, areaCode, code }).lean();
  if (existing) throw new HttpError(409, `Ya existe la sub-área "${label}" en esta área.`);

  const doc = await SubAreaModel.create({
    _id: subAreaId(companyId, areaCode, code),
    companyId,
    areaCode,
    code,
    label,
    order: payload.order ?? 0
  });
  return toResponse(doc);
}

export async function updateSubArea(
  companyId: string,
  areaCode: string,
  code: string,
  payload: Partial<SubAreaPayload>
): Promise<SubAreaResponse> {
  const doc = await SubAreaModel.findById(subAreaId(companyId, areaCode, code));
  if (!doc) throw new HttpError(404, 'Sub-área no encontrada.');

  if (payload.label !== undefined) {
    const label = payload.label.trim();
    if (!label) throw new HttpError(400, 'El nombre de la sub-área es obligatorio.');
    doc.label = label;
  }
  if (payload.order !== undefined) doc.order = payload.order;

  await doc.save();
  return toResponse(doc);
}

export async function deleteSubArea(companyId: string, areaCode: string, code: string): Promise<void> {
  const doc = await SubAreaModel.findById(subAreaId(companyId, areaCode, code));
  if (!doc) throw new HttpError(404, 'Sub-área no encontrada.');
  await doc.deleteOne();
}

export async function deleteSubAreasOfArea(companyId: string, areaCode: string): Promise<void> {
  await SubAreaModel.deleteMany({ companyId, areaCode });
}
