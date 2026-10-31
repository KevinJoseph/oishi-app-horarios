import type { Request, Response } from 'express';
import { deleteBukRecinto, listBukRecintos, upsertBukRecinto } from '../services/bukRecinto.service.js';
import { HttpError } from '../utils/httpError.js';

function resolveStatus(error: unknown): number {
  if (error instanceof HttpError) return error.statusCode;
  return 500;
}

function resolveMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Error inesperado.';
}

export async function listBukRecintosController(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json(await listBukRecintos());
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function upsertBukRecintoController(req: Request, res: Response): Promise<void> {
  try {
    const saved = await upsertBukRecinto(String(req.params.companyId), req.body);
    res.status(200).json(saved);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function deleteBukRecintoController(req: Request, res: Response): Promise<void> {
  try {
    await deleteBukRecinto(String(req.params.companyId));
    res.status(204).end();
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}
