import type { Request, Response } from 'express';
import {
  buildPlannerContext,
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

function contextFromRequest(req: Request) {
  const override = req.query.companyId as string | undefined;
  const userCompanyId = req.authUser?.companyId ?? null;
  const isAdmin = req.authUser?.role === 'super_administrador' || req.authUser?.role === 'supervisor';
  const companyId = (isAdmin && override) ? override : userCompanyId;
  return buildPlannerContext(companyId);
}

export async function getPlannerStateController(req: Request, res: Response): Promise<void> {
  const state = await getOrCreatePlannerState(contextFromRequest(req));
  res.status(200).json(state);
}

export async function putPlannerStateController(req: Request, res: Response): Promise<void> {
  const payload = req.body as PlannerStatePayload;
  const updated = await replacePlannerState(contextFromRequest(req), payload);
  res.status(200).json(updated);
}

export async function putPlannerStatePartialController(req: Request, res: Response): Promise<void> {
  const payload = req.body as PlannerStatePartialUpdatePayload;
  await updatePlannerStatePartial(contextFromRequest(req), payload);
  res.status(200).json({ ok: true });
}

export async function putValidationRequirementsController(req: Request, res: Response): Promise<void> {
  const payload = req.body as ValidationRequirementsUpdatePayload;
  const updated = await updateValidationRequirements(contextFromRequest(req), payload);
  res.status(200).json(updated);
}

export async function resetPlannerStateController(req: Request, res: Response): Promise<void> {
  const seed = await resetPlannerState(contextFromRequest(req));
  res.status(200).json(seed);
}
