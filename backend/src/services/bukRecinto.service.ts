import { env } from '../config/env.js';
import { BukRecintoModel } from '../models/BukRecinto.js';
import { HttpError } from '../utils/httpError.js';

export type BukRecintoPayload = {
  code: string;
  name: string;
  attendanceEnabled?: boolean;
};

export type BukRecintoResponse = {
  companyId: string;
  code: string;
  name: string;
  attendanceEnabled: boolean;
  updatedAt: string;
};

function toResponse(doc: { companyId: string; code: string; name: string; attendanceEnabled: boolean; updatedAt: Date }): BukRecintoResponse {
  return {
    companyId: doc.companyId,
    code: doc.code,
    name: doc.name,
    attendanceEnabled: doc.attendanceEnabled,
    updatedAt: doc.updatedAt.toISOString()
  };
}

export async function listBukRecintos(): Promise<BukRecintoResponse[]> {
  const docs = await BukRecintoModel.find().sort({ code: 1 }).lean();
  return docs.map(toResponse);
}

export async function upsertBukRecinto(companyId: string, payload: BukRecintoPayload): Promise<BukRecintoResponse> {
  if (!env.geoVictoriaCompanies.some((company) => company.companyId === companyId)) {
    throw new HttpError(404, 'Empresa no encontrada.');
  }

  const code = String(payload?.code ?? '').trim().toUpperCase();
  const name = String(payload?.name ?? '').trim();
  if (!code || !name) {
    throw new HttpError(400, 'El código y el nombre del recinto son obligatorios.');
  }

  const duplicated = await BukRecintoModel.findOne({ code, companyId: { $ne: companyId } }).lean();
  if (duplicated) {
    throw new HttpError(409, `El código ${code} ya está asignado a otra empresa.`);
  }

  const doc = await BukRecintoModel.findOneAndUpdate(
    { _id: companyId },
    {
      $set: { companyId, code, name, attendanceEnabled: payload.attendanceEnabled ?? true }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return toResponse(doc);
}

export async function deleteBukRecinto(companyId: string): Promise<void> {
  await BukRecintoModel.deleteOne({ _id: companyId });
}
