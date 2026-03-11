import { PlannerStateModel } from '../models/PlannerState.js';
import { buildSeedState } from './seedState.js';
import {
  AREA_IDS,
  type AreaId,
  type PlannerStatePayload,
  type ValidationRequirements,
  type ValidationRequirementsUpdatePayload
} from '../types/planner.js';

const STATE_KEY = 'default';

function isAreaId(value: unknown): value is AreaId {
  return typeof value === 'string' && AREA_IDS.includes(value as AreaId);
}

function sanitizeValidationRequirements(input: unknown): ValidationRequirements {
  const source = (input ?? {}) as Partial<ValidationRequirements>;
  return {
    0: {
      opening: Number.isFinite(source[0]?.opening) ? Math.max(0, Math.trunc(source[0]!.opening)) : 0,
      closing: Number.isFinite(source[0]?.closing) ? Math.max(0, Math.trunc(source[0]!.closing)) : 0
    },
    1: {
      opening: Number.isFinite(source[1]?.opening) ? Math.max(0, Math.trunc(source[1]!.opening)) : 0,
      closing: Number.isFinite(source[1]?.closing) ? Math.max(0, Math.trunc(source[1]!.closing)) : 0
    },
    2: {
      opening: Number.isFinite(source[2]?.opening) ? Math.max(0, Math.trunc(source[2]!.opening)) : 0,
      closing: Number.isFinite(source[2]?.closing) ? Math.max(0, Math.trunc(source[2]!.closing)) : 0
    },
    3: {
      opening: Number.isFinite(source[3]?.opening) ? Math.max(0, Math.trunc(source[3]!.opening)) : 0,
      closing: Number.isFinite(source[3]?.closing) ? Math.max(0, Math.trunc(source[3]!.closing)) : 0
    },
    4: {
      opening: Number.isFinite(source[4]?.opening) ? Math.max(0, Math.trunc(source[4]!.opening)) : 0,
      closing: Number.isFinite(source[4]?.closing) ? Math.max(0, Math.trunc(source[4]!.closing)) : 0
    },
    5: {
      opening: Number.isFinite(source[5]?.opening) ? Math.max(0, Math.trunc(source[5]!.opening)) : 0,
      closing: Number.isFinite(source[5]?.closing) ? Math.max(0, Math.trunc(source[5]!.closing)) : 0
    },
    6: {
      opening: Number.isFinite(source[6]?.opening) ? Math.max(0, Math.trunc(source[6]!.opening)) : 0,
      closing: Number.isFinite(source[6]?.closing) ? Math.max(0, Math.trunc(source[6]!.closing)) : 0
    }
  };
}

function clearAllWeekValidators(weekAuditById: PlannerStatePayload['weekAuditById']): PlannerStatePayload['weekAuditById'] {
  const next: PlannerStatePayload['weekAuditById'] = {};
  for (const [weekId, audit] of Object.entries(weekAuditById)) {
    next[weekId] = {
      ...audit,
      validatedByName: null
    };
  }
  return next;
}

function sanitizePayload(payload: PlannerStatePayload): PlannerStatePayload {
  return {
    employees: payload.employees,
    roles: payload.roles,
    currentAreaId: payload.currentAreaId,
    timeSlots: payload.timeSlots,
    shiftRanges: payload.shiftRanges,
    validationRequirements: payload.validationRequirements,
    breakConfig: payload.breakConfig,
    timeSlotsByArea: payload.timeSlotsByArea,
    shiftRangesByArea: payload.shiftRangesByArea,
    validationRequirementsByArea: payload.validationRequirementsByArea,
    breakConfigByArea: payload.breakConfigByArea,
    weeks: payload.weeks,
    weekPlans: payload.weekPlans,
    validatedWeekIds: payload.validatedWeekIds,
    weekAuditById: payload.weekAuditById
  };
}

function mapUnknownState(raw: {
  employees: unknown[];
  roles: unknown[];
  currentAreaId?: unknown;
  timeSlots: unknown[];
  shiftRanges?: unknown;
  validationRequirements?: unknown;
  breakConfig?: unknown;
  timeSlotsByArea?: unknown;
  shiftRangesByArea?: unknown;
  validationRequirementsByArea?: unknown;
  breakConfigByArea?: unknown;
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
  const defaultBreakConfig = {
    enabled: false,
    startHour: 16,
    endHour: 17
  };

  return {
    employees: raw.employees as PlannerStatePayload['employees'],
    roles: raw.roles as PlannerStatePayload['roles'],
    currentAreaId: isAreaId(raw.currentAreaId) ? raw.currentAreaId : 'salon',
    timeSlots: raw.timeSlots as PlannerStatePayload['timeSlots'],
    shiftRanges: (raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges,
    validationRequirements:
      (raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements,
    breakConfig: (raw.breakConfig as PlannerStatePayload['breakConfig']) ?? defaultBreakConfig,
    timeSlotsByArea:
      raw.timeSlotsByArea && typeof raw.timeSlotsByArea === 'object'
        ? ({
            salon:
              (raw.timeSlotsByArea as Partial<PlannerStatePayload['timeSlotsByArea']>).salon ??
              (raw.timeSlots as PlannerStatePayload['timeSlots']),
            cocina:
              (raw.timeSlotsByArea as Partial<PlannerStatePayload['timeSlotsByArea']>).cocina ??
              (raw.timeSlots as PlannerStatePayload['timeSlots']),
            oficina:
              (raw.timeSlotsByArea as Partial<PlannerStatePayload['timeSlotsByArea']>).oficina ??
              (raw.timeSlots as PlannerStatePayload['timeSlots']),
            produccion:
              (raw.timeSlotsByArea as Partial<PlannerStatePayload['timeSlotsByArea']>).produccion ??
              (raw.timeSlots as PlannerStatePayload['timeSlots'])
          } satisfies PlannerStatePayload['timeSlotsByArea'])
        : {
            salon: raw.timeSlots as PlannerStatePayload['timeSlots'],
            cocina: raw.timeSlots as PlannerStatePayload['timeSlots'],
            oficina: raw.timeSlots as PlannerStatePayload['timeSlots'],
            produccion: raw.timeSlots as PlannerStatePayload['timeSlots']
          },
    shiftRangesByArea:
      raw.shiftRangesByArea && typeof raw.shiftRangesByArea === 'object'
        ? ({
            salon:
              (raw.shiftRangesByArea as Partial<PlannerStatePayload['shiftRangesByArea']>).salon ??
              ((raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges),
            cocina:
              (raw.shiftRangesByArea as Partial<PlannerStatePayload['shiftRangesByArea']>).cocina ??
              ((raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges),
            oficina:
              (raw.shiftRangesByArea as Partial<PlannerStatePayload['shiftRangesByArea']>).oficina ??
              ((raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges),
            produccion:
              (raw.shiftRangesByArea as Partial<PlannerStatePayload['shiftRangesByArea']>).produccion ??
              ((raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges)
          } satisfies PlannerStatePayload['shiftRangesByArea'])
        : {
            salon: ((raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges),
            cocina: ((raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges),
            oficina: ((raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges),
            produccion: ((raw.shiftRanges as PlannerStatePayload['shiftRanges']) ?? defaultShiftRanges)
          },
    validationRequirementsByArea:
      raw.validationRequirementsByArea && typeof raw.validationRequirementsByArea === 'object'
        ? ({
            salon:
              (raw.validationRequirementsByArea as Partial<PlannerStatePayload['validationRequirementsByArea']>).salon ??
              ((raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements),
            cocina:
              (raw.validationRequirementsByArea as Partial<PlannerStatePayload['validationRequirementsByArea']>).cocina ??
              ((raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements),
            oficina:
              (raw.validationRequirementsByArea as Partial<PlannerStatePayload['validationRequirementsByArea']>).oficina ??
              ((raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements),
            produccion:
              (raw.validationRequirementsByArea as Partial<PlannerStatePayload['validationRequirementsByArea']>).produccion ??
              ((raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements)
          } satisfies PlannerStatePayload['validationRequirementsByArea'])
        : {
            salon: ((raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements),
            cocina: ((raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements),
            oficina: ((raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements),
            produccion: ((raw.validationRequirements as PlannerStatePayload['validationRequirements']) ?? defaultValidationRequirements)
          },
    breakConfigByArea:
      raw.breakConfigByArea && typeof raw.breakConfigByArea === 'object'
        ? ({
            salon:
              (raw.breakConfigByArea as Partial<PlannerStatePayload['breakConfigByArea']>).salon ??
              ((raw.breakConfig as PlannerStatePayload['breakConfig']) ?? defaultBreakConfig),
            cocina:
              (raw.breakConfigByArea as Partial<PlannerStatePayload['breakConfigByArea']>).cocina ??
              ((raw.breakConfig as PlannerStatePayload['breakConfig']) ?? defaultBreakConfig),
            oficina:
              (raw.breakConfigByArea as Partial<PlannerStatePayload['breakConfigByArea']>).oficina ??
              ((raw.breakConfig as PlannerStatePayload['breakConfig']) ?? defaultBreakConfig),
            produccion:
              (raw.breakConfigByArea as Partial<PlannerStatePayload['breakConfigByArea']>).produccion ??
              ((raw.breakConfig as PlannerStatePayload['breakConfig']) ?? defaultBreakConfig)
          } satisfies PlannerStatePayload['breakConfigByArea'])
        : {
            salon: ((raw.breakConfig as PlannerStatePayload['breakConfig']) ?? defaultBreakConfig),
            cocina: ((raw.breakConfig as PlannerStatePayload['breakConfig']) ?? defaultBreakConfig),
            oficina: ((raw.breakConfig as PlannerStatePayload['breakConfig']) ?? defaultBreakConfig),
            produccion: ((raw.breakConfig as PlannerStatePayload['breakConfig']) ?? defaultBreakConfig)
          },
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

export async function updateValidationRequirements(
  payload: ValidationRequirementsUpdatePayload
): Promise<PlannerStatePayload> {
  const current = await getOrCreatePlannerState();
  const sanitized = sanitizeValidationRequirements(payload.validationRequirements);
  const nextState: PlannerStatePayload = {
    ...current,
    validationRequirements: sanitized,
    validationRequirementsByArea: {
      ...current.validationRequirementsByArea,
      [payload.areaId]: sanitized
    },
    validatedWeekIds: [],
    weekAuditById: clearAllWeekValidators(current.weekAuditById)
  };

  const updated = await PlannerStateModel.findOneAndUpdate(
    { key: STATE_KEY },
    {
      $set: {
        validationRequirements: nextState.validationRequirements,
        validationRequirementsByArea: nextState.validationRequirementsByArea,
        validatedWeekIds: nextState.validatedWeekIds,
        weekAuditById: nextState.weekAuditById
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
  );

  if (!updated) {
    throw new Error('Failed to persist validation requirements');
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
