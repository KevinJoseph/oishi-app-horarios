import { EmployeeModel } from '../models/Employee.js';
import { RoleModel } from '../models/Role.js';
import { WeekModel } from '../models/Week.js';
import { WeekPlanModel } from '../models/WeekPlan.js';
import { WeekConfigModel } from '../models/WeekConfig.js';
import { WeekAuditModel } from '../models/WeekAudit.js';
import { AreaSettingsModel } from '../models/AreaSettings.js';
import { AppSettingsModel } from '../models/AppSettings.js';
import { buildSeedState } from './seedState.js';
import {
  AREA_IDS,
  type AreaId,
  type BreakConfig,
  type Employee,
  type PlannerStatePayload,
  type PlannerStatePartialUpdatePayload,
  type Role,
  type ShiftRanges,
  type TimeSlot,
  type ValidationRequirements,
  type ValidationRequirementsUpdatePayload,
  type Week,
  type WeekAudit,
  type WeekConfigurationSnapshot,
  type WeekPlan
} from '../types/planner.js';

const APP_SETTINGS_ID = 'default';
export const DEFAULT_COMPANY_ID = '__default__';

function isAreaId(value: unknown): value is AreaId {
  return typeof value === 'string' && AREA_IDS.includes(value as AreaId);
}

function resolveCompanyId(companyId: string | null | undefined): string {
  const trimmed = (companyId ?? '').trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_COMPANY_ID;
}

function scopedKey(companyId: string, areaId: AreaId, baseWeekId: string): string {
  return `${companyId}::${areaId}::${baseWeekId}`;
}

function areaSettingsKey(companyId: string, areaId: AreaId): string {
  return `${companyId}::${areaId}`;
}

function parseWeekScope(key: string): { companyId: string; areaId: AreaId; baseWeekId: string } | null {
  const parts = key.split('::');
  if (parts.length !== 3) return null;
  const [companyId, areaId, baseWeekId] = parts;
  if (!isAreaId(areaId)) return null;
  return { companyId, areaId, baseWeekId };
}

function defaultValidationRequirements(): ValidationRequirements {
  return {
    0: { opening: 0, closing: 0 },
    1: { opening: 0, closing: 0 },
    2: { opening: 0, closing: 0 },
    3: { opening: 0, closing: 0 },
    4: { opening: 0, closing: 0 },
    5: { opening: 0, closing: 0 },
    6: { opening: 0, closing: 0 }
  };
}

function sanitizeValidationRequirements(input: unknown): ValidationRequirements {
  const source = (input ?? {}) as Partial<ValidationRequirements>;
  const out = defaultValidationRequirements();
  for (const key of [0, 1, 2, 3, 4, 5, 6] as const) {
    const entry = source[key];
    if (entry) {
      out[key] = {
        opening: Number.isFinite(entry.opening) ? Math.max(0, Math.trunc(entry.opening)) : 0,
        closing: Number.isFinite(entry.closing) ? Math.max(0, Math.trunc(entry.closing)) : 0
      };
    }
  }
  return out;
}

/**
 * Legacy scopedWeekId from the frontend is `${areaId}::${weekId}`. Convert it to the
 * new internal `${companyId}::${areaId}::${weekId}` using the caller's company context.
 * Accepts either format to be lenient with stored validation keys.
 */
function normalizeIncomingScopedKey(rawKey: string, companyId: string): string | null {
  const trimmed = rawKey.trim();
  if (!trimmed) return null;

  // Drop any legacy `::company:xxx` suffix.
  const withoutCompanySuffix = trimmed.replace(/::company:[^:]*$/i, '');

  const parts = withoutCompanySuffix.split('::');
  if (parts.length === 3) {
    const [, areaId, baseWeekId] = parts;
    if (!isAreaId(areaId)) return null;
    return scopedKey(companyId, areaId, baseWeekId);
  }
  if (parts.length === 2) {
    const [areaId, baseWeekId] = parts;
    if (!isAreaId(areaId)) return null;
    return scopedKey(companyId, areaId, baseWeekId);
  }
  return null;
}

async function ensureSeeded(): Promise<void> {
  const appSettings = await AppSettingsModel.findById(APP_SETTINGS_ID).lean();
  if (appSettings) return;

  const seed = buildSeedState();
  await AppSettingsModel.create({
    _id: APP_SETTINGS_ID,
    currentAreaId: seed.currentAreaId
  });
}

type PlannerStateContext = {
  companyId: string;
};

export async function getOrCreatePlannerState(context: PlannerStateContext): Promise<PlannerStatePayload> {
  await ensureSeeded();

  const { companyId } = context;

  const [
    employeeDocs,
    roleDocs,
    weekDocs,
    weekPlanDocs,
    weekConfigDocs,
    weekAuditDocs,
    areaSettingsDocs,
    appSettings
  ] = await Promise.all([
    EmployeeModel.find({ companyId }).lean(),
    RoleModel.find({ companyId }).lean(),
    WeekModel.find({ companyId }).lean(),
    WeekPlanModel.find({ companyId }).lean(),
    WeekConfigModel.find({ companyId }).lean(),
    WeekAuditModel.find({ companyId }).lean(),
    AreaSettingsModel.find({ companyId }).lean(),
    AppSettingsModel.findById(APP_SETTINGS_ID).lean()
  ]);

  const employees = employeeDocs.map((doc) => doc.data as Employee);
  const roles: Role[] = roleDocs.map((doc) => ({
    ...(doc.data as Role),
    companyId: doc.companyId,
    areaId: isAreaId(doc.areaId) ? (doc.areaId as AreaId) : 'salon'
  }));
  const weeks: Week[] = weekDocs.map((doc) => ({
    id: doc.baseWeekId,
    label: doc.label,
    startDateISO: doc.startDateISO
  }));

  // Frontend keys expected as `${areaId}::${weekId}` (legacy format) — map from internal keys.
  const toLegacyScope = (areaId: AreaId, baseWeekId: string): string => `${areaId}::${baseWeekId}`;

  const weekPlans: Record<string, WeekPlan> = {};
  for (const doc of weekPlanDocs) {
    const areaId: AreaId = isAreaId(doc.areaId) ? (doc.areaId as AreaId) : 'salon';
    const key = toLegacyScope(areaId, doc.baseWeekId);
    weekPlans[key] = {
      weekId: key,
      days: doc.days as WeekPlan['days']
    };
  }

  const weekConfigById: PlannerStatePayload['weekConfigById'] = {};
  for (const doc of weekConfigDocs) {
    const areaId: AreaId = isAreaId(doc.areaId) ? (doc.areaId as AreaId) : 'salon';
    const key = toLegacyScope(areaId, doc.baseWeekId);
    weekConfigById[key] = {
      areaId,
      timeSlots: doc.timeSlots as TimeSlot[],
      shiftRanges: doc.shiftRanges as ShiftRanges,
      validationRequirements: sanitizeValidationRequirements(doc.validationRequirements),
      breakConfig: doc.breakConfig as BreakConfig
    };
  }

  const weekAuditById: Record<string, WeekAudit> = {};
  const validatedWeekIds: string[] = [];
  for (const doc of weekAuditDocs) {
    const areaId: AreaId = isAreaId(doc.areaId) ? (doc.areaId as AreaId) : 'salon';
    const key = toLegacyScope(areaId, doc.baseWeekId);
    weekAuditById[key] = {
      createdByName: doc.createdByName ?? null,
      validatedByName: doc.validatedByName ?? null
    };
    if (doc.validated) {
      validatedWeekIds.push(key);
    }
  }

  const defaultTimeSlots: TimeSlot[] = [];
  const defaultShiftRanges: ShiftRanges = {
    day: { startHour: 12, endHour: 17 },
    night: { startHour: 17, endHour: 22 }
  };
  const defaultBreak: BreakConfig = { enabled: false, startHour: 16, endHour: 17 };

  const timeSlotsByArea = {
    salon: defaultTimeSlots,
    cocina: defaultTimeSlots,
    oficina: defaultTimeSlots,
    produccion: defaultTimeSlots
  } as PlannerStatePayload['timeSlotsByArea'];
  const shiftRangesByArea = {
    salon: defaultShiftRanges,
    cocina: defaultShiftRanges,
    oficina: defaultShiftRanges,
    produccion: defaultShiftRanges
  } as PlannerStatePayload['shiftRangesByArea'];
  const validationRequirementsByArea = {
    salon: defaultValidationRequirements(),
    cocina: defaultValidationRequirements(),
    oficina: defaultValidationRequirements(),
    produccion: defaultValidationRequirements()
  } as PlannerStatePayload['validationRequirementsByArea'];
  const breakConfigByArea = {
    salon: defaultBreak,
    cocina: defaultBreak,
    oficina: defaultBreak,
    produccion: defaultBreak
  } as PlannerStatePayload['breakConfigByArea'];

  for (const doc of areaSettingsDocs) {
    if (!isAreaId(doc.areaId)) continue;
    timeSlotsByArea[doc.areaId as AreaId] = doc.timeSlots as TimeSlot[];
    shiftRangesByArea[doc.areaId as AreaId] = doc.shiftRanges as ShiftRanges;
    validationRequirementsByArea[doc.areaId as AreaId] = sanitizeValidationRequirements(doc.validationRequirements);
    breakConfigByArea[doc.areaId as AreaId] = doc.breakConfig as BreakConfig;
  }

  const currentAreaId: AreaId = isAreaId(appSettings?.currentAreaId)
    ? (appSettings!.currentAreaId as AreaId)
    : 'salon';

  return {
    employees,
    roles,
    currentAreaId,
    timeSlots: timeSlotsByArea[currentAreaId],
    shiftRanges: shiftRangesByArea[currentAreaId],
    validationRequirements: validationRequirementsByArea[currentAreaId],
    breakConfig: breakConfigByArea[currentAreaId],
    timeSlotsByArea,
    shiftRangesByArea,
    validationRequirementsByArea,
    breakConfigByArea,
    weeks,
    weekPlans,
    validatedWeekIds,
    weekAuditById,
    weekConfigById
  };
}

async function replaceEmployeesForCompany(companyId: string, employees: Employee[]): Promise<void> {
  const ids: string[] = [];
  const ops = employees.map((employee) => {
    const id = `${companyId}::${employee.id}`;
    ids.push(id);
    return {
      updateOne: {
        filter: { _id: id },
        update: { $set: { companyId, baseEmployeeId: employee.id, data: employee } },
        upsert: true
      }
    };
  });

  if (ops.length > 0) {
    await EmployeeModel.bulkWrite(ops, { ordered: false });
  }
  await EmployeeModel.deleteMany({ companyId, _id: { $nin: ids } });
}

async function replaceRolesForCompany(companyId: string, roles: Role[]): Promise<void> {
  const ids = roles.map((role) => role.id);
  const ops = roles.map((role) => {
    const areaId: AreaId = isAreaId(role.areaId) ? (role.areaId as AreaId) : 'salon';
    return {
      updateOne: {
        filter: { _id: role.id },
        update: {
          $set: {
            companyId,
            areaId,
            data: { ...role, companyId, areaId }
          }
        },
        upsert: true
      }
    };
  });

  if (ops.length > 0) {
    await RoleModel.bulkWrite(ops, { ordered: false });
  }
  // Only delete roles for this company that are not in the payload.
  await RoleModel.deleteMany({ companyId, _id: { $nin: ids } });
}

async function replaceWeeksForCompany(companyId: string, weeks: Week[]): Promise<void> {
  const ids: string[] = [];
  const ops = weeks.map((week) => {
    const id = `${companyId}::${week.id}`;
    ids.push(id);
    return {
      updateOne: {
        filter: { _id: id },
        update: {
          $set: {
            companyId,
            baseWeekId: week.id,
            label: week.label,
            startDateISO: week.startDateISO
          }
        },
        upsert: true
      }
    };
  });

  if (ops.length > 0) {
    await WeekModel.bulkWrite(ops, { ordered: false });
  }
  await WeekModel.deleteMany({ companyId, _id: { $nin: ids } });
}

async function upsertWeekPlan(companyId: string, legacyKey: string, plan: WeekPlan): Promise<void> {
  const parts = legacyKey.split('::');
  if (parts.length !== 2) return;
  const [rawAreaId, baseWeekId] = parts;
  if (!isAreaId(rawAreaId)) return;
  const areaId = rawAreaId as AreaId;
  const id = scopedKey(companyId, areaId, baseWeekId);

  await WeekPlanModel.updateOne(
    { _id: id },
    {
      $set: {
        companyId,
        areaId,
        baseWeekId,
        days: plan.days
      }
    },
    { upsert: true }
  );
}

async function upsertWeekConfig(
  companyId: string,
  legacyKey: string,
  config: WeekConfigurationSnapshot
): Promise<void> {
  const parts = legacyKey.split('::');
  if (parts.length !== 2) return;
  const [rawAreaId, baseWeekId] = parts;
  if (!isAreaId(rawAreaId)) return;
  const areaId: AreaId = isAreaId(config.areaId) ? (config.areaId as AreaId) : (rawAreaId as AreaId);
  const id = scopedKey(companyId, areaId, baseWeekId);

  await WeekConfigModel.updateOne(
    { _id: id },
    {
      $set: {
        companyId,
        areaId,
        baseWeekId,
        timeSlots: config.timeSlots,
        shiftRanges: config.shiftRanges,
        validationRequirements: sanitizeValidationRequirements(config.validationRequirements),
        breakConfig: config.breakConfig
      }
    },
    { upsert: true }
  );
}

async function upsertWeekAudit(
  companyId: string,
  rawKey: string,
  audit: WeekAudit | undefined,
  validated: boolean | undefined
): Promise<void> {
  // Strip legacy `::company:xxx` suffix and normalize area+week.
  const withoutCompanySuffix = rawKey.replace(/::company:[^:]*$/i, '');
  const parts = withoutCompanySuffix.split('::');
  if (parts.length !== 2) return;
  const [rawAreaId, baseWeekId] = parts;
  if (!isAreaId(rawAreaId)) return;
  const areaId = rawAreaId as AreaId;
  const id = scopedKey(companyId, areaId, baseWeekId);

  const set: Record<string, unknown> = {
    companyId,
    areaId,
    baseWeekId
  };
  if (audit) {
    set.createdByName = audit.createdByName ?? null;
    set.validatedByName = audit.validatedByName ?? null;
  }
  if (typeof validated === 'boolean') {
    set.validated = validated;
  }
  await WeekAuditModel.updateOne({ _id: id }, { $set: set }, { upsert: true });
}

export async function updatePlannerStatePartial(
  context: PlannerStateContext,
  payload: PlannerStatePartialUpdatePayload
): Promise<void> {
  const { companyId } = context;
  const ops: Promise<unknown>[] = [];

  if (payload.employees) ops.push(replaceEmployeesForCompany(companyId, payload.employees));
  if (payload.roles) ops.push(replaceRolesForCompany(companyId, payload.roles));
  if (payload.weeks) ops.push(replaceWeeksForCompany(companyId, payload.weeks));

  for (const entry of payload.weekEntries ?? []) {
    if (!entry.weekId?.trim()) continue;

    if (entry.weekPlan) {
      ops.push(upsertWeekPlan(companyId, entry.weekId, entry.weekPlan));
    }
    if (entry.weekConfig) {
      ops.push(upsertWeekConfig(companyId, entry.weekId, entry.weekConfig));
    }
    if (entry.weekAudit || typeof entry.validated === 'boolean') {
      ops.push(upsertWeekAudit(companyId, entry.weekId, entry.weekAudit, entry.validated));
    }
  }

  await Promise.all(ops);
}

export async function replacePlannerState(
  context: PlannerStateContext,
  payload: PlannerStatePayload
): Promise<PlannerStatePayload> {
  const { companyId } = context;

  await Promise.all([
    replaceEmployeesForCompany(companyId, payload.employees),
    replaceRolesForCompany(companyId, payload.roles),
    replaceWeeksForCompany(companyId, payload.weeks),
    AppSettingsModel.updateOne(
      { _id: APP_SETTINGS_ID },
      { $set: { currentAreaId: payload.currentAreaId } },
      { upsert: true }
    ),
    ...AREA_IDS.map((areaId) =>
      AreaSettingsModel.updateOne(
        { _id: areaSettingsKey(companyId, areaId) },
        {
          $set: {
            companyId,
            areaId,
            timeSlots: payload.timeSlotsByArea[areaId],
            shiftRanges: payload.shiftRangesByArea[areaId],
            validationRequirements: sanitizeValidationRequirements(payload.validationRequirementsByArea[areaId]),
            breakConfig: payload.breakConfigByArea[areaId]
          }
        },
        { upsert: true }
      )
    )
  ]);

  const weekPlanOps = Object.entries(payload.weekPlans).map(([key, plan]) => upsertWeekPlan(companyId, key, plan));
  const weekConfigOps = Object.entries(payload.weekConfigById).map(([key, config]) =>
    upsertWeekConfig(companyId, key, config)
  );
  const auditKeys = new Set<string>([...Object.keys(payload.weekAuditById), ...payload.validatedWeekIds]);
  const weekAuditOps = Array.from(auditKeys).map((key) =>
    upsertWeekAudit(companyId, key, payload.weekAuditById[key], payload.validatedWeekIds.includes(key))
  );

  await Promise.all([...weekPlanOps, ...weekConfigOps, ...weekAuditOps]);
  return getOrCreatePlannerState(context);
}

export async function updateValidationRequirements(
  context: PlannerStateContext,
  payload: ValidationRequirementsUpdatePayload
): Promise<PlannerStatePayload> {
  const { companyId } = context;
  const sanitized = sanitizeValidationRequirements(payload.validationRequirements);
  await AreaSettingsModel.updateOne(
    { _id: areaSettingsKey(companyId, payload.areaId) },
    {
      $set: {
        companyId,
        areaId: payload.areaId,
        validationRequirements: sanitized
      },
      $setOnInsert: {
        timeSlots: [],
        shiftRanges: { day: { startHour: 12, endHour: 17 }, night: { startHour: 17, endHour: 22 } },
        breakConfig: { enabled: false, startHour: 16, endHour: 17 }
      }
    },
    { upsert: true }
  );
  return getOrCreatePlannerState(context);
}

export async function resetPlannerState(context: PlannerStateContext): Promise<PlannerStatePayload> {
  const { companyId } = context;
  await Promise.all([
    EmployeeModel.deleteMany({ companyId }),
    RoleModel.deleteMany({ companyId }),
    WeekModel.deleteMany({ companyId }),
    WeekPlanModel.deleteMany({ companyId }),
    WeekConfigModel.deleteMany({ companyId }),
    WeekAuditModel.deleteMany({ companyId }),
    AreaSettingsModel.deleteMany({ companyId })
  ]);
  return getOrCreatePlannerState(context);
}

export function buildPlannerContext(companyId: string | null | undefined): PlannerStateContext {
  return { companyId: resolveCompanyId(companyId) };
}
