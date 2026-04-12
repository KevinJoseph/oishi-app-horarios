import type { Request, Response } from 'express';
import { createArea, deleteArea, listAreas, updateArea } from '../services/area.service.js';
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

export async function listAreasController(req: Request, res: Response): Promise<void> {
  try {
    const companyId = resolveCompanyId(req);
    const areas = await listAreas(companyId);
    res.status(200).json(areas);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function createAreaController(req: Request, res: Response): Promise<void> {
  try {
    const companyId = resolveCompanyId(req);
    const created = await createArea(companyId, req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function updateAreaController(req: Request, res: Response): Promise<void> {
  try {
    const companyId = resolveCompanyId(req);
    const areaCode = String(req.params.code);
    const updated = await updateArea(companyId, areaCode, req.body);
    res.status(200).json(updated);
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}

export async function deleteAreaController(req: Request, res: Response): Promise<void> {
  try {
    const companyId = resolveCompanyId(req);
    const areaCode = String(req.params.code);
    await deleteArea(companyId, areaCode);
    res.status(204).end();
  } catch (error) {
    res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
  }
}
