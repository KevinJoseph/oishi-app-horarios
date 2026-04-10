import type { NextFunction, Request, Response } from 'express';
import { findSessionUserByToken } from '../services/auth.service.js';
import type { PublicUser } from '../types/auth.js';

function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.authorization;
  if (!authorization) return null;

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }

  const user = await findSessionUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
    return;
  }

  req.authUser = user;
  req.authToken = token;
  next();
}

export function isSuperAdmin(user: PublicUser | null | undefined): boolean {
  return user?.role === 'super_administrador';
}

export function canWritePlanning(user: PublicUser | null | undefined): boolean {
  return user?.role === 'super_administrador' || user?.role === 'administrador' || user?.role === 'supervisor';
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }

  if (!isSuperAdmin(req.authUser)) {
    res.status(403).json({ error: 'No autorizado. Se requiere perfil Super Administrador.' });
    return;
  }

  next();
}

export function requirePlannerWrite(req: Request, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }

  if (!canWritePlanning(req.authUser)) {
    res
      .status(403)
      .json({ error: 'No autorizado. Se requiere perfil Super Administrador, Administrador o Supervisor.' });
    return;
  }

  next();
}
