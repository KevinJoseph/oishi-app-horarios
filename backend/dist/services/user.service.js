import { UserModel } from '../models/User.js';
import { hashPassword } from './password.service.js';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { SessionModel } from '../models/Session.js';
function normalizeUsername(value) {
    return value.trim().toLowerCase();
}
function validateRole(role) {
    return role === 'super_administrador' || role === 'administrador' || role === 'supervisor';
}
export function validatePassword(password) {
    if (password.trim().length < 6) {
        throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres.');
    }
}
function validateName(name) {
    if (!name.trim()) {
        throw new HttpError(400, 'El nombre es obligatorio.');
    }
}
function validateUsername(username) {
    const normalized = normalizeUsername(username);
    if (normalized.length < 3) {
        throw new HttpError(400, 'El usuario debe tener al menos 3 caracteres.');
    }
}
function normalizeOptionalCellular(celular) {
    const normalized = celular?.trim() ?? '';
    return normalized ? normalized : null;
}
function normalizeCellularKey(celular) {
    return (celular ?? '').replace(/\D/g, '');
}
function validateCellular(celular) {
    if (!celular) {
        return;
    }
    if (celular.length > 20) {
        throw new HttpError(400, 'El celular no puede superar 20 caracteres.');
    }
    if (!/^[0-9+\-\s()]+$/.test(celular)) {
        throw new HttpError(400, 'El celular solo puede contener números, espacios, +, - y paréntesis.');
    }
}
function normalizeOptionalCompanyId(companyId) {
    const normalized = companyId?.trim() ?? '';
    return normalized ? normalized : null;
}
function resolveCompanyLabel(companyId) {
    if (!companyId) {
        return null;
    }
    const company = env.geoVictoriaCompanies.find((item) => item.companyId === companyId);
    if (!company) {
        return null;
    }
    return `${company.alias} - ${company.name}`;
}
function validateCompanyAccess(role, companyId) {
    if (role === 'super_administrador' || role === 'supervisor') {
        return null;
    }
    if (!companyId) {
        throw new HttpError(400, 'Debe seleccionar una empresa para usuarios Administrador.');
    }
    const exists = env.geoVictoriaCompanies.some((company) => company.companyId === companyId);
    if (!exists) {
        throw new HttpError(400, 'La empresa seleccionada no es válida.');
    }
    return companyId;
}
export function toPublicUser(user) {
    const companyId = normalizeOptionalCompanyId(user.companyId);
    const celular = normalizeOptionalCellular(user.celular);
    return {
        id: String(user._id),
        username: user.username,
        name: user.name,
        celular,
        role: user.role,
        companyId,
        companyLabel: resolveCompanyLabel(companyId),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
    };
}
export async function ensureDefaultAdminUser() {
    validateUsername(env.defaultAdminUsername);
    validateName(env.defaultAdminName);
    validatePassword(env.defaultAdminPassword);
    const normalizedUsername = normalizeUsername(env.defaultAdminUsername);
    const existing = await UserModel.findOne({ username: normalizedUsername });
    if (!existing) {
        const { passwordHash, passwordSalt } = hashPassword(env.defaultAdminPassword);
        await UserModel.create({
            username: normalizedUsername,
            name: env.defaultAdminName.trim(),
            celular: null,
            role: 'super_administrador',
            companyId: null,
            passwordHash,
            passwordSalt
        });
        return;
    }
    let changed = false;
    if (existing.role !== 'super_administrador') {
        existing.role = 'super_administrador';
        changed = true;
    }
    if (existing.name !== env.defaultAdminName.trim()) {
        existing.name = env.defaultAdminName.trim();
        changed = true;
    }
    if ((existing.companyId ?? null) !== null) {
        existing.companyId = null;
        changed = true;
    }
    if (changed) {
        await existing.save();
    }
}
export async function listUsers() {
    await ensureDefaultAdminUser();
    const users = await UserModel.find().sort({ createdAt: -1 }).lean();
    return users.map((user) => toPublicUser(user));
}
export async function createUser(payload) {
    validateUsername(payload.username);
    validateName(payload.name);
    validateCellular(normalizeOptionalCellular(payload.celular));
    validatePassword(payload.password);
    if (!validateRole(payload.role)) {
        throw new HttpError(400, 'Rol inválido.');
    }
    const normalizedUsername = normalizeUsername(payload.username);
    const normalizedCompanyId = validateCompanyAccess(payload.role, normalizeOptionalCompanyId(payload.companyId));
    const existing = await UserModel.findOne({ username: normalizedUsername }).lean();
    if (existing) {
        throw new HttpError(409, 'Ya existe un usuario con ese nombre de usuario.');
    }
    const { passwordHash, passwordSalt } = hashPassword(payload.password);
    const created = await UserModel.create({
        username: normalizedUsername,
        name: payload.name.trim(),
        celular: normalizeOptionalCellular(payload.celular),
        role: payload.role,
        companyId: normalizedCompanyId,
        passwordHash,
        passwordSalt
    });
    return toPublicUser(created.toObject());
}
export async function updateUser(userId, payload, actorUserId) {
    const user = await UserModel.findById(userId);
    if (!user) {
        throw new HttpError(404, 'Usuario no encontrado.');
    }
    let shouldInvalidateSessions = false;
    if (payload.username !== undefined) {
        validateUsername(payload.username);
        user.username = normalizeUsername(payload.username);
    }
    if (payload.name !== undefined) {
        validateName(payload.name);
        user.name = payload.name.trim();
    }
    if (payload.celular !== undefined) {
        const normalizedCellular = normalizeOptionalCellular(payload.celular);
        validateCellular(normalizedCellular);
        user.celular = normalizedCellular;
    }
    if (payload.role !== undefined) {
        if (!validateRole(payload.role)) {
            throw new HttpError(400, 'Rol inválido.');
        }
        if (user.role === 'super_administrador' && payload.role !== 'super_administrador' && String(user._id) === actorUserId) {
            const admins = await UserModel.countDocuments({ role: 'super_administrador' });
            if (admins <= 1) {
                throw new HttpError(400, 'Debe existir al menos un usuario Super Administrador.');
            }
        }
        user.role = payload.role;
        shouldInvalidateSessions = true;
    }
    if (payload.companyId !== undefined || payload.role !== undefined) {
        const nextRole = payload.role ?? user.role;
        const nextCompanyId = payload.companyId !== undefined ? normalizeOptionalCompanyId(payload.companyId) : user.companyId ?? null;
        const validatedCompanyId = validateCompanyAccess(nextRole, nextCompanyId);
        if ((user.companyId ?? null) !== validatedCompanyId) {
            shouldInvalidateSessions = true;
        }
        user.companyId = validatedCompanyId;
    }
    if (payload.password !== undefined) {
        validatePassword(payload.password);
        const { passwordHash, passwordSalt } = hashPassword(payload.password);
        user.passwordHash = passwordHash;
        user.passwordSalt = passwordSalt;
    }
    try {
        await user.save();
    }
    catch (error) {
        if (error?.code === 11000) {
            throw new HttpError(409, 'Ya existe un usuario con ese nombre de usuario.');
        }
        throw error;
    }
    if (shouldInvalidateSessions) {
        await SessionModel.deleteMany({ userId: user._id });
    }
    return toPublicUser(user.toObject());
}
export async function deleteUser(userId, actorUserId) {
    const user = await UserModel.findById(userId).lean();
    if (!user) {
        throw new HttpError(404, 'Usuario no encontrado.');
    }
    if (String(user._id) === actorUserId) {
        throw new HttpError(400, 'No puedes eliminar tu propio usuario en sesión.');
    }
    if (user.role === 'super_administrador') {
        const admins = await UserModel.countDocuments({ role: 'super_administrador' });
        if (admins <= 1) {
            throw new HttpError(400, 'Debe existir al menos un usuario Super Administrador.');
        }
    }
    await UserModel.findByIdAndDelete(userId);
    await SessionModel.deleteMany({ userId });
}
export async function validateCellphoneExists(celular) {
    const target = normalizeCellularKey(celular);
    if (!target) {
        throw new HttpError(400, 'El celular es obligatorio.');
    }
    const users = await UserModel.find({ celular: { $ne: null } }).lean();
    const match = users.find((user) => normalizeCellularKey(user.celular) === target);
    return {
        exists: Boolean(match),
        userId: match ? String(match._id) : null
    };
}
