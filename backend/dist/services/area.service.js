import { AreaModel } from '../models/Area.js';
import { HttpError } from '../utils/httpError.js';
function areaId(companyId, code) {
    return `${companyId}::${code}`;
}
function normalizeCode(raw) {
    return raw.trim().toLowerCase().replace(/\s+/g, '_');
}
function toResponse(doc) {
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
export async function listAreas(companyId) {
    const docs = await AreaModel.find({ companyId }).sort({ order: 1, code: 1 }).lean();
    return docs.map(toResponse);
}
export async function createArea(companyId, payload) {
    const code = normalizeCode(payload.code ?? '');
    const label = (payload.label ?? '').trim();
    if (!code)
        throw new HttpError(400, 'El código del área es obligatorio.');
    if (!label)
        throw new HttpError(400, 'El nombre del área es obligatorio.');
    const existing = await AreaModel.findOne({ companyId, code }).lean();
    if (existing)
        throw new HttpError(409, `Ya existe un área con código "${code}" en esta empresa.`);
    const doc = await AreaModel.create({
        _id: areaId(companyId, code),
        companyId,
        code,
        label,
        order: payload.order ?? 0
    });
    return toResponse(doc);
}
export async function updateArea(companyId, areaCode, payload) {
    const id = areaId(companyId, areaCode);
    const doc = await AreaModel.findById(id);
    if (!doc)
        throw new HttpError(404, 'Área no encontrada.');
    if (payload.label !== undefined) {
        const label = payload.label.trim();
        if (!label)
            throw new HttpError(400, 'El nombre del área es obligatorio.');
        doc.label = label;
    }
    if (payload.order !== undefined) {
        doc.order = payload.order;
    }
    await doc.save();
    return toResponse(doc);
}
export async function deleteArea(companyId, areaCode) {
    const id = areaId(companyId, areaCode);
    const doc = await AreaModel.findById(id);
    if (!doc)
        throw new HttpError(404, 'Área no encontrada.');
    await doc.deleteOne();
}
export async function getAreaCodesForCompany(companyId) {
    const docs = await AreaModel.find({ companyId }).sort({ order: 1, code: 1 }).lean();
    return docs.map((d) => d.code);
}
