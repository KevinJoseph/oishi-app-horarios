import { PlannerStateModel } from '../models/PlannerState.js';
import { buildSeedState } from './seedState.js';
import type { PlannerStatePayload } from '../types/planner.js';

const STATE_KEY = 'default';

function sanitizePayload(payload: PlannerStatePayload): PlannerStatePayload {
  return {
    employees: payload.employees,
    roles: payload.roles,
    timeSlots: payload.timeSlots,
    weeks: payload.weeks,
    weekPlans: payload.weekPlans
  };
}

function mapUnknownState(raw: {
  employees: unknown[];
  roles: unknown[];
  timeSlots: unknown[];
  weeks: unknown[];
  weekPlans: Record<string, unknown>;
}): PlannerStatePayload {
  return {
    employees: raw.employees as PlannerStatePayload['employees'],
    roles: raw.roles as PlannerStatePayload['roles'],
    timeSlots: raw.timeSlots as PlannerStatePayload['timeSlots'],
    weeks: raw.weeks as PlannerStatePayload['weeks'],
    weekPlans: raw.weekPlans as PlannerStatePayload['weekPlans']
  };
}

export async function getOrCreatePlannerState(): Promise<PlannerStatePayload> {
  const existing = await PlannerStateModel.findOne({ key: STATE_KEY }).lean();
  if (existing) {
    return mapUnknownState(existing);
  }

  const seed = buildSeedState();
  await PlannerStateModel.create({ key: STATE_KEY, ...seed });
  return seed;
}

export async function replacePlannerState(payload: PlannerStatePayload): Promise<PlannerStatePayload> {
  const sanitized = sanitizePayload(payload);
  const updated = await PlannerStateModel.findOneAndUpdate(
    { key: STATE_KEY },
    { $set: sanitized },
    { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
  );

  if (!updated) {
    throw new Error('Failed to persist planner state');
  }

  return mapUnknownState(updated);
}

export async function resetPlannerState(): Promise<PlannerStatePayload> {
  const seed = buildSeedState();
  await PlannerStateModel.findOneAndUpdate(
    { key: STATE_KEY },
    { $set: seed },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return seed;
}
