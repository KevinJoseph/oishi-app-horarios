import type { Request, Response } from 'express';
import { listBukShifts, registerBukShifts } from '../services/bukShift.service.js';
import { HttpError } from '../utils/httpError.js';

function resolveStatus(error: unknown): number {
  if (error instanceof HttpError) return error.statusCode;
  return 500;
}

function resolveMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Error inesperado.';
}

export async function listBukShiftsController(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json(await listBukShifts());
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function registerBukShiftsController(req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json(await registerBukShifts(req.body?.shifts));
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}
