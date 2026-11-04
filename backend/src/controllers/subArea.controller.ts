import type { Request, Response } from 'express';
import { createSubArea, deleteSubArea, listSubAreas, updateSubArea } from '../services/subArea.service.js';
import { HttpError } from '../utils/httpError.js';
import { buildPlannerContext } from '../services/plannerState.service.js';

function resolveStatus(error: unknown): number {
  if (error instanceof HttpError) return error.statusCode;
  return 500;
}

function resolveMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Error inesperado.';
}

function resolveCompanyId(req: Request): string {
  const override = req.query.companyId;
  if (typeof override === 'string' && override.trim()) return override.trim();
  return buildPlannerContext(req.authUser?.companyId).companyId;
}

export async function listAllSubAreasController(req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json(await listSubAreas(resolveCompanyId(req)));
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function listSubAreasController(req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json(await listSubAreas(resolveCompanyId(req), String(req.params.code)));
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function createSubAreaController(req: Request, res: Response): Promise<void> {
  try {
    const created = await createSubArea(resolveCompanyId(req), String(req.params.code), req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function updateSubAreaController(req: Request, res: Response): Promise<void> {
  try {
    const updated = await updateSubArea(
      resolveCompanyId(req),
      String(req.params.code),
      String(req.params.subCode),
      req.body
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function deleteSubAreaController(req: Request, res: Response): Promise<void> {
  try {
    await deleteSubArea(resolveCompanyId(req), String(req.params.code), String(req.params.subCode));
    res.status(204).end();
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}
