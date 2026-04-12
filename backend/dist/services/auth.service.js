import { createHash, randomBytes } from 'node:crypto';
import { SessionModel } from '../models/Session.js';
import { PasswordResetTokenModel } from '../models/PasswordResetToken.js';
import { UserModel } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { ensureDefaultAdminUser, toPublicUser, validatePassword } from './user.service.js';
import { env } from '../config/env.js';
import jwt from 'jsonwebtoken';
const SESSION_DURATION_MS = env.authSessionDays * 24 * 60 * 60 * 1000;
function normalizeUsername(value) {
    return value.trim().toLowerCase();
}
function hashResetToken(token) {
    return createHash('sha256').update(token).digest('hex');
}
function signAuthToken(payload) {
    return jwt.sign({
        sub: payload.userId,
        username: payload.username,
        role: payload.role
    }, env.authJwtSecret, {
        algorithm: 'HS256',
        expiresIn: `${env.authSessionDays}d`
    });
}
function verifyAuthToken(token) {
    try {
        const decoded = jwt.verify(token, env.authJwtSecret, { algorithms: ['HS256'] });
        if (!decoded || typeof decoded === 'string') {
            return null;
        }
        if (typeof decoded.sub !== 'string' || typeof decoded.username !== 'string' || typeof decoded.role !== 'string') {
            return null;
        }
        return decoded;
    }
    catch {
        return null;
    }
}
function buildPasswordResetToken() {
    return randomBytes(32).toString('hex');
}
export async function login(payload) {
    await ensureDefaultAdminUser();
    const username = normalizeUsername(payload.username ?? '');
    const password = payload.password ?? '';
    if (!username || !password) {
        throw new HttpError(400, 'Usuario y contraseña son obligatorios.');
    }
    const user = await UserModel.findOne({ username }).lean();
    if (!user) {
        throw new HttpError(401, 'Credenciales inválidas.');
    }
    const validPassword = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!validPassword) {
        throw new HttpError(401, 'Credenciales inválidas.');
    }
    const token = signAuthToken({
        userId: String(user._id),
        username: user.username,
        role: user.role
    });
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await SessionModel.create({
        userId: user._id,
        token,
        expiresAt
    });
    return {
        token,
        user: toPublicUser(user)
    };
}
export async function findSessionUserByToken(token) {
    const decoded = verifyAuthToken(token);
    if (!decoded) {
        return null;
    }
    const session = await SessionModel.findOne({ token, expiresAt: { $gt: new Date() } }).lean();
    if (!session) {
        return null;
    }
    if (String(session.userId) !== decoded.sub) {
        return null;
    }
    const user = await UserModel.findById(decoded.sub).lean();
    if (!user) {
        await SessionModel.deleteOne({ _id: session._id });
        return null;
    }
    return toPublicUser(user);
}
export async function logoutByToken(token) {
    await SessionModel.deleteOne({ token });
}
export async function changePassword(userId, token, payload) {
    const currentPassword = payload.currentPassword ?? '';
    const newPassword = payload.newPassword ?? '';
    const confirmNewPassword = payload.confirmNewPassword ?? '';
    if (!currentPassword.trim() || !newPassword.trim()) {
        throw new HttpError(400, 'La contraseña actual y la nueva contraseña son obligatorias.');
    }
    if (confirmNewPassword && newPassword !== confirmNewPassword) {
        throw new HttpError(400, 'La confirmación de la nueva contraseña no coincide.');
    }
    validatePassword(newPassword);
    const user = await UserModel.findById(userId);
    if (!user) {
        throw new HttpError(404, 'Usuario no encontrado.');
    }
    const validCurrentPassword = verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
    if (!validCurrentPassword) {
        throw new HttpError(400, 'La contraseña actual no es correcta.');
    }
    if (currentPassword === newPassword) {
        throw new HttpError(400, 'La nueva contraseña debe ser diferente a la actual.');
    }
    const { passwordHash, passwordSalt } = hashPassword(newPassword);
    user.passwordHash = passwordHash;
    user.passwordSalt = passwordSalt;
    await user.save();
    await SessionModel.deleteMany({ userId: user._id, token: { $ne: token } });
}
export async function requestPasswordReset(payload) {
    const username = normalizeUsername(payload.username ?? '');
    if (!username) {
        throw new HttpError(400, 'El usuario es obligatorio.');
    }
    const user = await UserModel.findOne({ username }).lean();
    if (!user) {
        throw new HttpError(404, 'Usuario no encontrado.');
    }
    await PasswordResetTokenModel.deleteMany({ userId: user._id });
    const resetToken = buildPasswordResetToken();
    const expiresAt = new Date(Date.now() + env.authPasswordResetMinutes * 60 * 1000);
    await PasswordResetTokenModel.create({
        userId: user._id,
        tokenHash: hashResetToken(resetToken),
        expiresAt,
        usedAt: null
    });
    return {
        message: 'Token de recuperación generado correctamente.',
        resetToken,
        expiresAt: expiresAt.toISOString()
    };
}
export async function resetPassword(payload) {
    const resetToken = payload.resetToken ?? '';
    const newPassword = payload.newPassword ?? '';
    const confirmNewPassword = payload.confirmNewPassword ?? '';
    if (!resetToken.trim() || !newPassword.trim()) {
        throw new HttpError(400, 'El token de recuperación y la nueva contraseña son obligatorios.');
    }
    if (confirmNewPassword && newPassword !== confirmNewPassword) {
        throw new HttpError(400, 'La confirmación de la nueva contraseña no coincide.');
    }
    validatePassword(newPassword);
    const tokenHash = hashResetToken(resetToken.trim());
    const resetEntry = await PasswordResetTokenModel.findOne({
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: new Date() }
    });
    if (!resetEntry) {
        throw new HttpError(400, 'Token de recuperación inválido o expirado.');
    }
    const user = await UserModel.findById(resetEntry.userId);
    if (!user) {
        await PasswordResetTokenModel.deleteOne({ _id: resetEntry._id });
        throw new HttpError(404, 'Usuario no encontrado.');
    }
    const { passwordHash, passwordSalt } = hashPassword(newPassword);
    user.passwordHash = passwordHash;
    user.passwordSalt = passwordSalt;
    await user.save();
    resetEntry.usedAt = new Date();
    await resetEntry.save();
    await SessionModel.deleteMany({ userId: user._id });
}
export async function adminResetPassword(payload) {
    const userId = (payload.userId ?? '').trim();
    const newPassword = (payload.newPassword ?? '').trim();
    if (!userId || !newPassword) {
        throw new HttpError(400, 'El ID del usuario y la nueva contraseña son obligatorios.');
    }
    validatePassword(newPassword);
    const user = await UserModel.findById(userId);
    if (!user) {
        throw new HttpError(404, 'Usuario no encontrado.');
    }
    const { passwordHash, passwordSalt } = hashPassword(newPassword);
    user.passwordHash = passwordHash;
    user.passwordSalt = passwordSalt;
    await user.save();
    await SessionModel.deleteMany({ userId: user._id });
}
