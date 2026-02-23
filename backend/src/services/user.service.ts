import type { CreateUserPayload, PublicUser, UpdateUserPayload, UserRole } from '../types/auth.js';
import { UserModel } from '../models/User.js';
import { hashPassword } from './password.service.js';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { SessionModel } from '../models/Session.js';

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function validateRole(role: string): role is UserRole {
  return role === 'administrador' || role === 'lector';
}

function validatePassword(password: string): void {
  if (password.trim().length < 6) {
    throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres.');
  }
}

function validateName(name: string): void {
  if (!name.trim()) {
    throw new HttpError(400, 'El nombre es obligatorio.');
  }
}

function validateUsername(username: string): void {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) {
    throw new HttpError(400, 'El usuario debe tener al menos 3 caracteres.');
  }
}

export function toPublicUser(user: {
  _id: unknown;
  username: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: String(user._id),
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export async function ensureDefaultAdminUser(): Promise<void> {
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
      role: 'administrador',
      passwordHash,
      passwordSalt
    });
    return;
  }

  let changed = false;

  if (existing.role !== 'administrador') {
    existing.role = 'administrador';
    changed = true;
  }

  if (existing.name !== env.defaultAdminName.trim()) {
    existing.name = env.defaultAdminName.trim();
    changed = true;
  }

  if (changed) {
    await existing.save();
  }
}

export async function listUsers(): Promise<PublicUser[]> {
  await ensureDefaultAdminUser();
  const users = await UserModel.find().sort({ createdAt: -1 }).lean();
  return users.map((user) => toPublicUser(user));
}

export async function createUser(payload: CreateUserPayload): Promise<PublicUser> {
  validateUsername(payload.username);
  validateName(payload.name);
  validatePassword(payload.password);

  if (!validateRole(payload.role)) {
    throw new HttpError(400, 'Rol inválido.');
  }

  const normalizedUsername = normalizeUsername(payload.username);
  const existing = await UserModel.findOne({ username: normalizedUsername }).lean();
  if (existing) {
    throw new HttpError(409, 'Ya existe un usuario con ese nombre de usuario.');
  }

  const { passwordHash, passwordSalt } = hashPassword(payload.password);
  const created = await UserModel.create({
    username: normalizedUsername,
    name: payload.name.trim(),
    role: payload.role,
    passwordHash,
    passwordSalt
  });

  return toPublicUser(created.toObject());
}

export async function updateUser(
  userId: string,
  payload: UpdateUserPayload,
  actorUserId: string
): Promise<PublicUser> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new HttpError(404, 'Usuario no encontrado.');
  }

  if (payload.username !== undefined) {
    validateUsername(payload.username);
    user.username = normalizeUsername(payload.username);
  }

  if (payload.name !== undefined) {
    validateName(payload.name);
    user.name = payload.name.trim();
  }

  if (payload.role !== undefined) {
    if (!validateRole(payload.role)) {
      throw new HttpError(400, 'Rol inválido.');
    }

    if (user.role === 'administrador' && payload.role === 'lector' && String(user._id) === actorUserId) {
      const admins = await UserModel.countDocuments({ role: 'administrador' });
      if (admins <= 1) {
        throw new HttpError(400, 'Debe existir al menos un usuario administrador.');
      }
    }

    user.role = payload.role;
  }

  if (payload.password !== undefined) {
    validatePassword(payload.password);
    const { passwordHash, passwordSalt } = hashPassword(payload.password);
    user.passwordHash = passwordHash;
    user.passwordSalt = passwordSalt;
  }

  try {
    await user.save();
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      throw new HttpError(409, 'Ya existe un usuario con ese nombre de usuario.');
    }
    throw error;
  }

  return toPublicUser(user.toObject());
}

export async function deleteUser(userId: string, actorUserId: string): Promise<void> {
  const user = await UserModel.findById(userId).lean();
  if (!user) {
    throw new HttpError(404, 'Usuario no encontrado.');
  }

  if (String(user._id) === actorUserId) {
    throw new HttpError(400, 'No puedes eliminar tu propio usuario en sesión.');
  }

  if (user.role === 'administrador') {
    const admins = await UserModel.countDocuments({ role: 'administrador' });
    if (admins <= 1) {
      throw new HttpError(400, 'Debe existir al menos un usuario administrador.');
    }
  }

  await UserModel.findByIdAndDelete(userId);
  await SessionModel.deleteMany({ userId });
}
