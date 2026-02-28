import { PlannerStateModel } from '../models/PlannerState.js';
import { buildSeedState } from './seedState.js';
import type { PlannerStatePayload } from '../types/planner.js';

const STATE_KEY = 'default';

function sanitizePayload(payload: PlannerStatePayload): PlannerStatePayload {
  return {
    employees: payload.employees,
    roles: payload.roles,
    timeSlots: payload.timeSlots,
    shiftRanges: payload.shiftRanges,
    validationRequirements: payload.validationRequirements,
    weeks: payload.weeks,
    weekPlans: payload.weekPlans,
    validatedWeekIds: payload.validatedWeekIds,
    weekAuditById: payload.weekAuditById
  };
}

function mapUnknownState(raw: {
  employees: unknown[];
  roles: unknown[];
  timeSlots: unknown[];
  shiftRanges?: unknown;
  validationRequirements?: unknown;
  weeks: unknown[];
  weekPlans: Record<string, unknown>;
  validatedWeekIds?: unknown;
  weekAuditById?: unknown;
}): PlannerStatePayload {
  const defaultShiftRanges = {
    day: { startHour: 12, endHour: 17 },
    night: { startHour: 17, endHour: 22 }
  };
  const defaultValidationRequirements = {
    0: { opening: 0, closing: 0 },
    1: { opening: 0, closing: 0 },
    2: { opening: 0, closing: 0 },
    3: { opening: 0, closing: 0 },
    4: { opening: 0, closing: 0 },
    5: { opening: 0, closing: 0 },
    6: { opening: 0, closing: 0 }
  };

  return {
    employees: raw.employees as PlannerStatePayload['employees'],
    roles: raw.roles as PlannerStatePayload['roles'],
    timeSlots: raw.timeSlots as PlannerStatePayload['timeSlots'],
    shiftRanges: (raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges,
    validationRequirements:
      (raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements,
    weeks: raw.weeks as PlannerStatePayload['weeks'],
    weekPlans: raw.weekPlans as PlannerStatePayload['weekPlans'],
    validatedWeekIds: Array.isArray(raw.validatedWeekIds)
      ? raw.validatedWeekIds.filter((value): value is string => typeof value === 'string')
      : [],
    weekAuditById:
      raw.weekAuditById && typeof raw.weekAuditById === 'object'
        ? (raw.weekAuditById as PlannerStatePayload['weekAuditById'])
        : {}
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
  const resetState: PlannerStatePayload = {
    ...seed,
    employees: seed.employees.map((employee) => ({
      ...employee,
      contractType: undefined,
      shiftType: undefined,
      weeklyHours: 0
    }))
  };
  await PlannerStateModel.findOneAndUpdate(
    { key: STATE_KEY },
    { $set: resetState },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return resetState;
}
