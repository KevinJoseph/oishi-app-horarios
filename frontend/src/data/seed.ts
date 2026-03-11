import { addDays, formatISO, parseISO } from 'date-fns';
import { buildEmptyWeekPlan, buildMockWeeks, mockEmployees, mockRoles, mockTimeSlots } from './mocks';
import type {
  AreaId,
  BreakConfig,
  BreakConfigByArea,
  Role,
  ShiftRanges,
  ShiftRangesByArea,
  TimeSlot,
  TimeSlotsByArea,
  ValidationRequirements,
  ValidationRequirementsByArea,
  WeekConfigurationById,
  WeekConfigurationSnapshot,
  WeekAudit,
  WeekPlan
} from '../types';
import { buildWeekLabel, formatDayNameEs } from '../utils/dates';

const AREA_IDS: AreaId[] = ['salon', 'cocina', 'oficina', 'produccion'];
const DEFAULT_AREA_ID: AreaId = 'salon';

export type SeedState = {
  employees: typeof mockEmployees;
  roles: typeof mockRoles;
  currentAreaId: AreaId;
  timeSlots: TimeSlot[];
  shiftRanges: ShiftRanges;
  validationRequirements: ValidationRequirements;
  breakConfig: BreakConfig;
  timeSlotsByArea: TimeSlotsByArea;
  shiftRangesByArea: ShiftRangesByArea;
  validationRequirementsByArea: ValidationRequirementsByArea;
  breakConfigByArea: BreakConfigByArea;
  weeks: ReturnType<typeof buildMockWeeks>;
  weekPlans: Record<string, WeekPlan>;
  validatedWeekIds: string[];
  weekAuditById: Record<string, WeekAudit>;
  weekConfigById: WeekConfigurationById;
};

function scopedWeekKey(areaId: AreaId, weekId: string): string {
  return `${areaId}::${weekId}`;
}

function normalizeRolesByArea(roles: Role[]): Role[] {
  return roles.map((role) => ({
    ...role,
    areaId: role.areaId ?? DEFAULT_AREA_ID
  }));
}

function cloneTimeSlots(timeSlots: TimeSlot[]): TimeSlot[] {
  return timeSlots.map((slot) => ({ ...slot }));
}

function sanitizeWeekAudit(value: unknown): WeekAudit {
  const source = value as Partial<WeekAudit> | null | undefined;
  return {
    createdByName: typeof source?.createdByName === 'string' ? source.createdByName : null,
    validatedByName: typeof source?.validatedByName === 'string' ? source.validatedByName : null
  };
}

function buildDefaultShiftRanges(timeSlots: SeedState['timeSlots']): ShiftRanges {
  const ordered = [...timeSlots].sort((a, b) => a.order - b.order);
  const startHour = Number.parseInt(ordered[0]?.start.slice(0, 2) ?? '12', 10);
  const endHour = Number.parseInt(ordered[ordered.length - 1]?.end.slice(0, 2) ?? '22', 10);
  const span = endHour - startHour;

  if (span <= 1) {
    return {
      day: { startHour, endHour },
      night: { startHour, endHour }
    };
  }

  const splitHour = startHour + Math.floor(span / 2);
  return {
    day: { startHour, endHour: splitHour },
    night: { startHour: splitHour, endHour }
  };
}

function normalizeShiftRanges(input: Partial<ShiftRanges> | undefined, timeSlots: SeedState['timeSlots']): ShiftRanges {
  const defaults = buildDefaultShiftRanges(timeSlots);
  if (!input) return defaults;

  const day = input.day;
  const night = input.night;
  const dayValid = day && Number.isInteger(day.startHour) && Number.isInteger(day.endHour) && day.endHour > day.startHour;
  const nightValid =
    night && Number.isInteger(night.startHour) && Number.isInteger(night.endHour) && night.endHour > night.startHour;

  if (!dayValid || !nightValid) return defaults;

  return {
    day: { startHour: day.startHour, endHour: day.endHour },
    night: { startHour: night.startHour, endHour: night.endHour }
  };
}

function buildDefaultValidationRequirements(): ValidationRequirements {
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

function normalizeValidationRequirements(input: ValidationRequirements | undefined): ValidationRequirements {
  const defaults = buildDefaultValidationRequirements();
  if (!input) return defaults;

  const sanitized: ValidationRequirements = { ...defaults };
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    const source = input[day];
    const opening = Number.isFinite(source?.opening) ? Math.max(0, Math.trunc(source.opening)) : 0;
    const closing = Number.isFinite(source?.closing) ? Math.max(0, Math.trunc(source.closing)) : 0;
    sanitized[day] = { opening, closing };
  }
  return sanitized;
}

function buildDefaultBreakConfig(timeSlots: SeedState['timeSlots']): BreakConfig {
  const ordered = [...timeSlots].sort((a, b) => a.order - b.order);
  const startHour = Number.parseInt(ordered[0]?.start.slice(0, 2) ?? '12', 10);
  const endHour = Number.parseInt(ordered[ordered.length - 1]?.end.slice(0, 2) ?? '22', 10);
  const clampedStart = Math.min(startHour + 4, endHour - 1);
  const fallbackStart = Number.isInteger(clampedStart) ? clampedStart : Math.max(startHour, endHour - 1);
  const fallbackEnd = Math.min(fallbackStart + 1, endHour);
  return {
    enabled: false,
    startHour: fallbackStart,
    endHour: fallbackEnd
  };
}

function cloneShiftRanges(input: ShiftRanges): ShiftRanges {
  return {
    day: { ...input.day },
    night: { ...input.night }
  };
}

function cloneBreakConfig(input: BreakConfig): BreakConfig {
  return {
    enabled: Boolean(input.enabled),
    startHour: input.startHour,
    endHour: input.endHour
  };
}

function buildWeekConfigurationSnapshot(
  areaId: AreaId,
  timeSlotsByArea: TimeSlotsByArea,
  shiftRangesByArea: ShiftRangesByArea,
  validationRequirementsByArea: ValidationRequirementsByArea,
  breakConfigByArea: BreakConfigByArea
): WeekConfigurationSnapshot {
  return {
    areaId,
    timeSlots: cloneTimeSlots(timeSlotsByArea[areaId]),
    shiftRanges: cloneShiftRanges(shiftRangesByArea[areaId]),
    validationRequirements: normalizeValidationRequirements(validationRequirementsByArea[areaId]),
    breakConfig: cloneBreakConfig(breakConfigByArea[areaId])
  };
}

function normalizeWeekConfigurationSnapshot(
  input: unknown,
  fallbackAreaId: AreaId,
  fallback: WeekConfigurationSnapshot
): WeekConfigurationSnapshot {
  const source = (input ?? {}) as Partial<WeekConfigurationSnapshot>;
  const areaId = AREA_IDS.includes(source.areaId as AreaId) ? (source.areaId as AreaId) : fallbackAreaId;
  return {
    areaId,
    timeSlots: Array.isArray(source.timeSlots) ? cloneTimeSlots(source.timeSlots) : cloneTimeSlots(fallback.timeSlots),
    shiftRanges: source.shiftRanges ? normalizeShiftRanges(source.shiftRanges, fallback.timeSlots) : cloneShiftRanges(fallback.shiftRanges),
    validationRequirements: normalizeValidationRequirements(source.validationRequirements ?? fallback.validationRequirements),
    breakConfig: source.breakConfig ? normalizeBreakConfig(source.breakConfig, fallback.timeSlots) : cloneBreakConfig(fallback.breakConfig)
  };
}

function normalizeBreakConfig(input: BreakConfig | undefined, timeSlots: SeedState['timeSlots']): BreakConfig {
  const defaults = buildDefaultBreakConfig(timeSlots);
  if (!input) return defaults;
  const enabled = Boolean(input.enabled);
  const startHour = Number.isInteger(input.startHour) ? input.startHour : defaults.startHour;
  const endHour = Number.isInteger(input.endHour) ? input.endHour : defaults.endHour;
  const ordered = [...timeSlots].sort((a, b) => a.order - b.order);
  const planningStartHour = Number.parseInt(ordered[0]?.start.slice(0, 2) ?? '12', 10);
  const planningEndHour = Number.parseInt(ordered[ordered.length - 1]?.end.slice(0, 2) ?? '22', 10);
  const valid = startHour >= planningStartHour && endHour <= planningEndHour && endHour > startHour;
  if (!valid) return defaults;
  return {
    enabled,
    startHour,
    endHour
  };
}

function normalizeWeekPlan(weekStartDateISO: string, sourcePlan: WeekPlan | undefined): WeekPlan {
  const start = parseISO(weekStartDateISO);
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const sourceDay = sourcePlan?.days[idx];
    const date = addDays(start, idx);
    const dateISO = formatISO(date, { representation: 'date' });
    return {
      dateISO,
      dayName: formatDayNameEs(dateISO),
      assignments: sourceDay?.assignments ?? {}
    };
  });

  return {
    weekId: sourcePlan?.weekId ?? '',
    days
  };
}

export function normalizePlannerState(input: SeedState): SeedState {
  const baseWeeks = input.weeks.length >= 4 ? input.weeks : buildMockWeeks();
  const normalizedWeeks = [...baseWeeks]
    .sort((a, b) => a.startDateISO.localeCompare(b.startDateISO))
    .map((week) => ({
      ...week,
      label: buildWeekLabel(parseISO(week.startDateISO))
    }));
  const weekPlans: Record<string, WeekPlan> = {};

  for (const week of normalizedWeeks) {
    for (const areaId of AREA_IDS) {
      const scopedKey = scopedWeekKey(areaId, week.id);
      const legacyKey = areaId === DEFAULT_AREA_ID ? week.id : '';
      const sourcePlan = input.weekPlans[scopedKey] ?? (legacyKey ? input.weekPlans[legacyKey] : undefined);
      const normalized = normalizeWeekPlan(week.startDateISO, sourcePlan);
      weekPlans[scopedKey] = {
        weekId: normalized.weekId || week.id,
        days: normalized.days
      };
    }
  }

  const normalizedEmployees = normalizeEmployeeCodes(input.employees).map((employee) => normalizeEmployeeContract(employee));
  const normalizedRoles = normalizeRolesByArea(input.roles);
  const currentAreaId = AREA_IDS.includes(input.currentAreaId as AreaId)
    ? (input.currentAreaId as AreaId)
    : DEFAULT_AREA_ID;
  const rawTimeSlotsByArea = (input.timeSlotsByArea ?? {}) as Partial<TimeSlotsByArea>;
  const rawShiftRangesByArea = (input.shiftRangesByArea ?? {}) as Partial<ShiftRangesByArea>;
  const rawValidationByArea = (input.validationRequirementsByArea ?? {}) as Partial<ValidationRequirementsByArea>;
  const rawBreakConfigByArea = (input.breakConfigByArea ?? {}) as Partial<BreakConfigByArea>;
  const fallbackTimeSlots = cloneTimeSlots(input.timeSlots);
  const fallbackShiftRanges = normalizeShiftRanges(input.shiftRanges, fallbackTimeSlots);
  const fallbackValidation = normalizeValidationRequirements(input.validationRequirements);
  const fallbackBreakConfig = normalizeBreakConfig(input.breakConfig, fallbackTimeSlots);
  const timeSlotsByArea = {
    salon: cloneTimeSlots(rawTimeSlotsByArea.salon ?? fallbackTimeSlots),
    cocina: cloneTimeSlots(rawTimeSlotsByArea.cocina ?? fallbackTimeSlots),
    oficina: cloneTimeSlots(rawTimeSlotsByArea.oficina ?? fallbackTimeSlots),
    produccion: cloneTimeSlots(rawTimeSlotsByArea.produccion ?? fallbackTimeSlots)
  } satisfies TimeSlotsByArea;
  const shiftRangesByArea = {
    salon: normalizeShiftRanges(rawShiftRangesByArea.salon ?? fallbackShiftRanges, timeSlotsByArea.salon),
    cocina: normalizeShiftRanges(rawShiftRangesByArea.cocina ?? fallbackShiftRanges, timeSlotsByArea.cocina),
    oficina: normalizeShiftRanges(rawShiftRangesByArea.oficina ?? fallbackShiftRanges, timeSlotsByArea.oficina),
    produccion: normalizeShiftRanges(rawShiftRangesByArea.produccion ?? fallbackShiftRanges, timeSlotsByArea.produccion)
  } satisfies ShiftRangesByArea;
  const validationRequirementsByArea = {
    salon: normalizeValidationRequirements(rawValidationByArea.salon ?? fallbackValidation),
    cocina: normalizeValidationRequirements(rawValidationByArea.cocina ?? fallbackValidation),
    oficina: normalizeValidationRequirements(rawValidationByArea.oficina ?? fallbackValidation),
    produccion: normalizeValidationRequirements(rawValidationByArea.produccion ?? fallbackValidation)
  } satisfies ValidationRequirementsByArea;
  const breakConfigByArea = {
    salon: normalizeBreakConfig(rawBreakConfigByArea.salon ?? fallbackBreakConfig, timeSlotsByArea.salon),
    cocina: normalizeBreakConfig(rawBreakConfigByArea.cocina ?? fallbackBreakConfig, timeSlotsByArea.cocina),
    oficina: normalizeBreakConfig(rawBreakConfigByArea.oficina ?? fallbackBreakConfig, timeSlotsByArea.oficina),
    produccion: normalizeBreakConfig(rawBreakConfigByArea.produccion ?? fallbackBreakConfig, timeSlotsByArea.produccion)
  } satisfies BreakConfigByArea;
  const knownWeekIds = new Set(normalizedWeeks.map((week) => week.id));
  const validatedWeekIds = (input.validatedWeekIds ?? [])
    .map((key) => {
      if (key.includes('::')) return key;
      return scopedWeekKey(DEFAULT_AREA_ID, key);
    })
    .filter((key) => {
      const [areaId, weekId] = key.split('::');
      return AREA_IDS.includes(areaId as AreaId) && knownWeekIds.has(weekId);
    });
  const weekAuditById: Record<string, WeekAudit> = {};
  const inputWeekAuditById = (input.weekAuditById ?? {}) as Record<string, unknown>;
  const inputWeekConfigById = (input.weekConfigById ?? {}) as Record<string, unknown>;
  for (const week of normalizedWeeks) {
    for (const areaId of AREA_IDS) {
      const scopedKey = scopedWeekKey(areaId, week.id);
      const legacyKey = areaId === DEFAULT_AREA_ID ? week.id : '';
      weekAuditById[scopedKey] = sanitizeWeekAudit(inputWeekAuditById[scopedKey] ?? (legacyKey ? inputWeekAuditById[legacyKey] : undefined));
    }
  }
  const weekConfigById: WeekConfigurationById = {};
  for (const scopedKey of validatedWeekIds) {
    const [areaIdFromKey] = scopedKey.split('::');
    const areaId = AREA_IDS.includes(areaIdFromKey as AreaId) ? (areaIdFromKey as AreaId) : DEFAULT_AREA_ID;
    const fallbackSnapshot = buildWeekConfigurationSnapshot(
      areaId,
      timeSlotsByArea,
      shiftRangesByArea,
      validationRequirementsByArea,
      breakConfigByArea
    );
    weekConfigById[scopedKey] = normalizeWeekConfigurationSnapshot(inputWeekConfigById[scopedKey], areaId, fallbackSnapshot);
  }

  return {
    employees: normalizedEmployees,
    roles: normalizedRoles as SeedState['roles'],
    currentAreaId,
    timeSlots: timeSlotsByArea[currentAreaId] ?? timeSlotsByArea.salon,
    shiftRanges: shiftRangesByArea[currentAreaId] ?? shiftRangesByArea.salon,
    validationRequirements: validationRequirementsByArea[currentAreaId] ?? validationRequirementsByArea.salon,
    breakConfig: breakConfigByArea[currentAreaId] ?? breakConfigByArea.salon,
    timeSlotsByArea,
    shiftRangesByArea,
    validationRequirementsByArea,
    breakConfigByArea,
    weeks: normalizedWeeks,
    weekPlans,
    validatedWeekIds,
    weekAuditById,
    weekConfigById
  };
}

export function loadSeedState(): SeedState {
  const employees = normalizeEmployeeCodes([...mockEmployees]);
  const roles = normalizeRolesByArea([...mockRoles]) as SeedState['roles'];
  const timeSlots = [...mockTimeSlots];
  const shiftRanges = buildDefaultShiftRanges(timeSlots);
  const validationRequirements = buildDefaultValidationRequirements();
  const breakConfig = buildDefaultBreakConfig(timeSlots);
  const timeSlotsByArea: TimeSlotsByArea = {
    salon: cloneTimeSlots(timeSlots),
    cocina: cloneTimeSlots(timeSlots),
    oficina: cloneTimeSlots(timeSlots),
    produccion: cloneTimeSlots(timeSlots)
  };
  const shiftRangesByArea: ShiftRangesByArea = {
    salon: buildDefaultShiftRanges(timeSlotsByArea.salon),
    cocina: buildDefaultShiftRanges(timeSlotsByArea.cocina),
    oficina: buildDefaultShiftRanges(timeSlotsByArea.oficina),
    produccion: buildDefaultShiftRanges(timeSlotsByArea.produccion)
  };
  const validationRequirementsByArea: ValidationRequirementsByArea = {
    salon: buildDefaultValidationRequirements(),
    cocina: buildDefaultValidationRequirements(),
    oficina: buildDefaultValidationRequirements(),
    produccion: buildDefaultValidationRequirements()
  };
  const breakConfigByArea: BreakConfigByArea = {
    salon: buildDefaultBreakConfig(timeSlotsByArea.salon),
    cocina: buildDefaultBreakConfig(timeSlotsByArea.cocina),
    oficina: buildDefaultBreakConfig(timeSlotsByArea.oficina),
    produccion: buildDefaultBreakConfig(timeSlotsByArea.produccion)
  };
  const weeks = buildMockWeeks();
  const weekPlans: Record<string, WeekPlan> = {};

  const employeeIds = employees.map((employee) => employee.id);
  const timeSlotIds = timeSlots.map((timeSlot) => timeSlot.id);

  for (const week of weeks) {
    for (const areaId of AREA_IDS) {
      weekPlans[scopedWeekKey(areaId, week.id)] = buildEmptyWeekPlan(week, employeeIds, timeSlotIds);
    }
  }

  const weekAuditById: Record<string, WeekAudit> = {};
  for (const week of weeks) {
    for (const areaId of AREA_IDS) {
      weekAuditById[scopedWeekKey(areaId, week.id)] = { createdByName: null, validatedByName: null };
    }
  }

  return {
    employees,
    roles,
    currentAreaId: DEFAULT_AREA_ID,
    timeSlots,
    shiftRanges,
    validationRequirements,
    breakConfig,
    timeSlotsByArea,
    shiftRangesByArea,
    validationRequirementsByArea,
    breakConfigByArea,
    weeks,
    weekPlans,
    validatedWeekIds: [],
    weekAuditById,
    weekConfigById: {}
  };
}

function normalizeEmployeeContract(employee: SeedState['employees'][number]): SeedState['employees'][number] {
  return {
    ...employee,
    weeklyHours: Math.max(0, employee.weeklyHours ?? 0)
  };
}

function normalizeEmployeeCodes<T extends { code?: string }>(employees: T[]): T[] {
  const used = new Set<number>();
  const next = employees.map((employee) => ({ ...employee }));

  for (const employee of next) {
    const match = employee.code?.trim().match(/^CO-(\d+)$/i);
    if (!match) continue;
    const numeric = Number.parseInt(match[1], 10);
    if (Number.isInteger(numeric) && numeric > 0) {
      used.add(numeric);
      employee.code = `CO-${String(numeric).padStart(2, '0')}`;
    }
  }

  let cursor = 1;
  for (const employee of next) {
    const match = employee.code?.trim().match(/^CO-(\d+)$/i);
    if (match) continue;
    while (used.has(cursor)) cursor += 1;
    employee.code = `CO-${String(cursor).padStart(2, '0')}`;
    used.add(cursor);
    cursor += 1;
  }

  return next;
}
