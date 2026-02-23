import type { Request, Response } from 'express';
import { login, logoutByToken } from '../services/auth.service.js';
import type { LoginPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

function resolveStatus(error: unknown): number {
  if (error instanceof HttpError) {
    return error.statusCode;
  }
  return 500;
}

function resolveMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Error inesperado.';
}

export async function loginController(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body as LoginPayload;
    const result = await login(payload);
    res.status(200).json(result);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function meController(req: Request, res: Response): Promise<void> {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }
  res.status(200).json(user);
}

export async function logoutController(req: Request, res: Response): Promise<void> {
  const token = req.authToken;
  if (!token) {
    res.status(204).end();
    return;
  }

  await logoutByToken(token);
  res.status(204).end();
}
