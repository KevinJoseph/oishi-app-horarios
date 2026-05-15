import { addDays, formatISO, parseISO } from 'date-fns';
import { buildEmptyWeekPlan, buildMockWeeks, mockEmployees, mockRoles, mockTimeSlots } from './mocks';
import type {
  AreaId,
  AreaInfo,
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
import { normalizeRestDayList } from '../utils/weekdays';

export type SeedState = {
  areas: AreaInfo[];
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

function normalizeValidationWeekKey(rawKey: string): string {
  const companyMarkerIndex = rawKey.indexOf('::company:');
  const baseKey = companyMarkerIndex >= 0 ? rawKey.slice(0, companyMarkerIndex) : rawKey;
  const companySuffix = companyMarkerIndex >= 0 ? rawKey.slice(companyMarkerIndex) : '';
  const normalizedBaseKey = baseKey;
  return `${normalizedBaseKey}${companySuffix}`;
}

function normalizeRolesByArea(roles: Role[]): Role[] {
  return roles.map((role) => ({ ...role }));
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
  const areaId = typeof source.areaId === 'string' && source.areaId.trim().length > 0 ? source.areaId : fallbackAreaId;
  const normalizedTimeSlots =
    Array.isArray(source.timeSlots) && source.timeSlots.length > 0
      ? cloneTimeSlots(source.timeSlots)
      : cloneTimeSlots(fallback.timeSlots);
  return {
    areaId,
    timeSlots: normalizedTimeSlots,
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

function normalizeRestDayOverridesMap(
  raw: Record<string, number | number[]> | undefined
): Record<string, number[]> | undefined {
  if (!raw) return undefined;
  const out: Record<string, number[]> = {};
  for (const [empId, value] of Object.entries(raw)) {
    const list = normalizeRestDayList(value);
    if (list.length > 0) out[empId] = list;
  }
  return Object.keys(out).length > 0 ? out : undefined;
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

  const overrides = normalizeRestDayOverridesMap(
    sourcePlan?.restDayOverrides as Record<string, number | number[]> | undefined
  );
  return {
    weekId: sourcePlan?.weekId ?? '',
    days,
    ...(overrides ? { restDayOverrides: overrides } : {})
  };
}

export function normalizePlannerState(input: SeedState): SeedState {
  const areas = input.areas ?? [];
  const baseAreaCodes = areas.map((a) => a.code);
  const extraAreaCodes = new Set<string>();
  for (const key of Object.keys(input.timeSlotsByArea ?? {})) extraAreaCodes.add(key);
  for (const key of Object.keys(input.breakConfigByArea ?? {})) extraAreaCodes.add(key);
  for (const key of Object.keys(input.weekPlans ?? {})) {
    const areaId = key.split('::')[0];
    if (areaId) extraAreaCodes.add(areaId);
  }
  for (const key of Object.keys(input.weekConfigById ?? {})) {
    const areaId = key.split('::')[0];
    if (areaId) extraAreaCodes.add(areaId);
  }
  const areaCodes = Array.from(new Set([...baseAreaCodes, ...extraAreaCodes]));
  const firstArea = areaCodes[0] ?? '';

  const baseWeeks = input.weeks.length >= 4 ? input.weeks : buildMockWeeks();
  const normalizedWeeks = [...baseWeeks]
    .sort((a, b) => a.startDateISO.localeCompare(b.startDateISO))
    .map((week) => ({
      ...week,
      label: buildWeekLabel(parseISO(week.startDateISO))
    }));
  const weekPlans: Record<string, WeekPlan> = {};

  for (const week of normalizedWeeks) {
    for (const areaId of areaCodes) {
      const scopedKey = scopedWeekKey(areaId, week.id);
      const legacyKey = areaId === firstArea ? week.id : '';
      const sourcePlan = input.weekPlans[scopedKey] ?? (legacyKey ? input.weekPlans[legacyKey] : undefined);

      const normalized = normalizeWeekPlan(week.startDateISO, sourcePlan);
      weekPlans[scopedKey] = {
        weekId: normalized.weekId || week.id,
        days: normalized.days,
        ...(normalized.restDayOverrides ? { restDayOverrides: normalized.restDayOverrides } : {})
      };
    }
  }

  const normalizedEmployees = normalizeEmployeeCodes(input.employees).map((employee) => normalizeEmployeeContract(employee));
  const normalizedRoles = normalizeRolesByArea(input.roles);
  const currentAreaId = areaCodes.includes(input.currentAreaId) ? input.currentAreaId : firstArea;
  const rawTimeSlotsByArea = (input.timeSlotsByArea ?? {}) as Partial<TimeSlotsByArea>;
  const rawShiftRangesByArea = (input.shiftRangesByArea ?? {}) as Partial<ShiftRangesByArea>;
  const rawValidationByArea = (input.validationRequirementsByArea ?? {}) as Partial<ValidationRequirementsByArea>;
  const rawBreakConfigByArea = (input.breakConfigByArea ?? {}) as Partial<BreakConfigByArea>;
  const fallbackTimeSlots = cloneTimeSlots(input.timeSlots);
  const fallbackShiftRanges = normalizeShiftRanges(input.shiftRanges, fallbackTimeSlots);
  const fallbackValidation = normalizeValidationRequirements(input.validationRequirements);
  const fallbackBreakConfig = normalizeBreakConfig(input.breakConfig, fallbackTimeSlots);

  const timeSlotsByArea: TimeSlotsByArea = {};
  const shiftRangesByArea: ShiftRangesByArea = {};
  const validationRequirementsByArea: ValidationRequirementsByArea = {};
  const breakConfigByArea: BreakConfigByArea = {};
  for (const code of areaCodes) {
    timeSlotsByArea[code] = cloneTimeSlots(rawTimeSlotsByArea[code] ?? fallbackTimeSlots);
    shiftRangesByArea[code] = normalizeShiftRanges(rawShiftRangesByArea[code] ?? fallbackShiftRanges, timeSlotsByArea[code]);
    validationRequirementsByArea[code] = normalizeValidationRequirements(rawValidationByArea[code] ?? fallbackValidation);
    breakConfigByArea[code] = normalizeBreakConfig(rawBreakConfigByArea[code] ?? fallbackBreakConfig, timeSlotsByArea[code]);
  }

  const areaCodeSet = new Set(areaCodes);
  const knownWeekIds = new Set(normalizedWeeks.map((week) => week.id));
  const validatedWeekIds = (input.validatedWeekIds ?? [])
    .map((key) => normalizeValidationWeekKey(key))
    .filter((key) => {
      const companyMarkerIndex = key.indexOf('::company:');
      const baseKey = companyMarkerIndex >= 0 ? key.slice(0, companyMarkerIndex) : key;
      const [areaId, weekId] = baseKey.split('::');
      return areaCodeSet.has(areaId) && knownWeekIds.has(weekId);
    });
  const weekAuditById: Record<string, WeekAudit> = {};
  const inputWeekAuditById = (input.weekAuditById ?? {}) as Record<string, unknown>;
  const inputWeekConfigById = (input.weekConfigById ?? {}) as Record<string, unknown>;
  for (const week of normalizedWeeks) {
    for (const areaId of areaCodes) {
      const scopedKey = scopedWeekKey(areaId, week.id);
      const legacyKey = areaId === firstArea ? week.id : '';
      weekAuditById[scopedKey] = sanitizeWeekAudit(inputWeekAuditById[scopedKey] ?? (legacyKey ? inputWeekAuditById[legacyKey] : undefined));
    }
  }
  for (const [rawKey, value] of Object.entries(inputWeekAuditById)) {
    const normalizedKey = normalizeValidationWeekKey(rawKey);
    const companyMarkerIndex = normalizedKey.indexOf('::company:');
    if (companyMarkerIndex < 0) continue;
    const baseKey = normalizedKey.slice(0, companyMarkerIndex);
    const [areaId, weekId] = baseKey.split('::');
    if (!areaCodeSet.has(areaId) || !knownWeekIds.has(weekId)) continue;
    weekAuditById[normalizedKey] = sanitizeWeekAudit(value);
  }
  const weekConfigById: WeekConfigurationById = {};
  const knownScopedWeekIds = new Set<string>();
  for (const week of normalizedWeeks) {
    for (const areaId of areaCodes) {
      knownScopedWeekIds.add(scopedWeekKey(areaId, week.id));
    }
  }
  for (const scopedKey of Object.keys(inputWeekConfigById)) {
    const normalizedScopedKey = scopedKey.includes('::') ? scopedKey : scopedWeekKey(firstArea, scopedKey);
    if (!knownScopedWeekIds.has(normalizedScopedKey)) continue;
    const [areaIdFromKey] = normalizedScopedKey.split('::');
    const areaId = areaCodeSet.has(areaIdFromKey) ? areaIdFromKey : firstArea;
    const fallbackSnapshot = buildWeekConfigurationSnapshot(
      areaId,
      timeSlotsByArea,
      shiftRangesByArea,
      validationRequirementsByArea,
      breakConfigByArea
    );
    weekConfigById[normalizedScopedKey] = normalizeWeekConfigurationSnapshot(
      inputWeekConfigById[scopedKey],
      areaId,
      fallbackSnapshot
    );
  }
  for (const scopedKey of validatedWeekIds) {
    if (weekConfigById[scopedKey]) continue;
    const [areaIdFromKey] = scopedKey.split('::');
    const areaId = areaCodeSet.has(areaIdFromKey) ? areaIdFromKey : firstArea;
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
    areas,
    employees: normalizedEmployees,
    roles: normalizedRoles as SeedState['roles'],
    currentAreaId,
    timeSlots: timeSlotsByArea[currentAreaId] ?? fallbackTimeSlots,
    shiftRanges: shiftRangesByArea[currentAreaId] ?? fallbackShiftRanges,
    validationRequirements: validationRequirementsByArea[currentAreaId] ?? fallbackValidation,
    breakConfig: breakConfigByArea[currentAreaId] ?? fallbackBreakConfig,
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
  const timeSlotsByArea: TimeSlotsByArea = {};
  const shiftRangesByArea: ShiftRangesByArea = {};
  const validationRequirementsByArea: ValidationRequirementsByArea = {};
  const breakConfigByArea: BreakConfigByArea = {};
  const weeks = buildMockWeeks();
  const weekPlans: Record<string, WeekPlan> = {};
  const weekAuditById: Record<string, WeekAudit> = {};

  return {
    areas: [],
    employees,
    roles,
    currentAreaId: '',
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
