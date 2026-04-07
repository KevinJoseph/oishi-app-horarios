import type { Request, Response } from 'express';
import {
  getOrCreatePlannerState,
  replacePlannerState,
  resetPlannerState,
  updatePlannerStatePartial,
  updateValidationRequirements
} from '../services/plannerState.service.js';
import type {
  PlannerStatePartialUpdatePayload,
  PlannerStatePayload,
  ValidationRequirementsUpdatePayload
} from '../types/planner.js';

export async function getPlannerStateController(_req: Request, res: Response): Promise<void> {
  const state = await getOrCreatePlannerState();
  res.status(200).json(state);
}

export async function putPlannerStateController(req: Request, res: Response): Promise<void> {
  const payload = req.body as PlannerStatePayload;
  const updated = await replacePlannerState(payload);
  res.status(200).json(updated);
}

export async function putPlannerStatePartialController(req: Request, res: Response): Promise<void> {
  const payload = req.body as PlannerStatePartialUpdatePayload;
  await updatePlannerStatePartial(payload);
  res.status(200).json({ ok: true });
}

export async function putValidationRequirementsController(req: Request, res: Response): Promise<void> {
  const payload = req.body as ValidationRequirementsUpdatePayload;
  const updated = await updateValidationRequirements(payload);
  res.status(200).json(updated);
}

export async function resetPlannerStateController(_req: Request, res: Response): Promise<void> {
  const seed = await resetPlannerState();
  res.status(200).json(seed);
}
