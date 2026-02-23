import { randomBytes } from 'node:crypto';
import { SessionModel } from '../models/Session.js';
import { UserModel } from '../models/User.js';
import type { LoginPayload, PublicUser } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';
import { verifyPassword } from './password.service.js';
import { ensureDefaultAdminUser, toPublicUser } from './user.service.js';
import { env } from '../config/env.js';

const SESSION_DURATION_MS = env.authSessionDays * 24 * 60 * 60 * 1000;

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function buildSessionToken(): string {
  return randomBytes(48).toString('hex');
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

  const token = buildSessionToken();
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
  const session = await SessionModel.findOne({ token, expiresAt: { $gt: new Date() } }).lean();
  if (!session) {
    return null;
  }

  const user = await UserModel.findById(session.userId).lean();
  if (!user) {
    await SessionModel.deleteOne({ _id: session._id });
    return null;
  }

  return toPublicUser(user);
}

export async function logoutByToken(token: string): Promise<void> {
  await SessionModel.deleteOne({ token });
}
