import type { Request, Response } from 'express';
import { createUser, deleteUser, listUsers, updateUser } from '../services/user.service.js';
import type { CreateUserPayload, UpdateUserPayload } from '../types/auth.js';
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

export async function listUsersController(_req: Request, res: Response): Promise<void> {
  try {
    const users = await listUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function createUserController(req: Request, res: Response): Promise<void> {
  try {
    const payload = req.body as CreateUserPayload;
    const created = await createUser(payload);
    res.status(201).json(created);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function updateUserController(req: Request, res: Response): Promise<void> {
  const actorId = req.authUser?.id;
  if (!actorId) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }

  try {
    const payload = req.body as UpdateUserPayload;
    const userId = String(req.params.id);
    const updated = await updateUser(userId, payload, actorId);
    res.status(200).json(updated);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function deleteUserController(req: Request, res: Response): Promise<void> {
  const actorId = req.authUser?.id;
  if (!actorId) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }

  try {
    const userId = String(req.params.id);
    await deleteUser(userId, actorId);
    res.status(204).end();
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}
