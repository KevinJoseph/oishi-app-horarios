import { createHash, randomBytes } from 'node:crypto';
import { SessionModel } from '../models/Session.js';
import { PasswordResetTokenModel } from '../models/PasswordResetToken.js';
import { UserModel } from '../models/User.js';
import type {
  AdminResetPasswordPayload,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginPayload,
  PublicUser,
  ResetPasswordPayload
} from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { ensureDefaultAdminUser, toPublicUser, validatePassword } from './user.service.js';
import { env } from '../config/env.js';
import jwt, { type JwtPayload } from 'jsonwebtoken';

const SESSION_DURATION_MS = env.authSessionDays * 24 * 60 * 60 * 1000;

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

type AuthJwtPayload = JwtPayload & {
  sub: string;
  username: string;
  role: string;
};

function signAuthToken(payload: { userId: string; username: string; role: string }): string {
  return jwt.sign(
    {
      sub: payload.userId,
      username: payload.username,
      role: payload.role
    },
    env.authJwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: `${env.authSessionDays}d`
    }
  );
}

function verifyAuthToken(token: string): AuthJwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.authJwtSecret, { algorithms: ['HS256'] });
    if (!decoded || typeof decoded === 'string') {
      return null;
    }

    if (typeof decoded.sub !== 'string' || typeof decoded.username !== 'string' || typeof decoded.role !== 'string') {
      return null;
    }

    return decoded as AuthJwtPayload;
  } catch {
    return null;
  }
}

function buildPasswordResetToken(): string {
  return randomBytes(32).toString('hex');
}

export async function login(payload: LoginPayload): Promise<{ token: string; user: PublicUser }> {
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

export async function findSessionUserByToken(token: string): Promise<PublicUser | null> {
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

export async function logoutByToken(token: string): Promise<void> {
  await SessionModel.deleteOne({ token });
}

export async function changePassword(
  userId: string,
  token: string,
  payload: ChangePasswordPayload
): Promise<void> {
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

export async function requestPasswordReset(
  payload: ForgotPasswordPayload
): Promise<{ message: string; resetToken: string; expiresAt: string }> {
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

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
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

export async function adminResetPassword(payload: AdminResetPasswordPayload): Promise<{ success: boolean; message: string }> {
  const userId = (payload.userId ?? '').trim();
  const newPassword = (payload.newPassword ?? '').trim();

  if (!userId || !newPassword) {
    return { success: false, message: 'El ID del usuario y la nueva contraseña son obligatorios.' };
  }

  if (!/^[a-f\d]{24}$/i.test(userId)) {
    return { success: false, message: 'El ID del usuario no es válido.' };
  }

  try {
    validatePassword(newPassword);
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'La contraseña no cumple los requisitos.' };
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    return { success: false, message: 'Usuario no encontrado.' };
  }

  const { passwordHash, passwordSalt } = hashPassword(newPassword);
  user.passwordHash = passwordHash;
  user.passwordSalt = passwordSalt;
  await user.save();

  await SessionModel.deleteMany({ userId: user._id });
  return { success: true, message: 'Contraseña restablecida correctamente.' };
}
