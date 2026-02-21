import { addDays, formatISO, parseISO } from 'date-fns';
import { buildEmptyWeekPlan, buildMockWeeks, mockEmployees, mockRoles, mockTimeSlots } from './mocks';
import type { ShiftRanges, ValidationRequirements, WeekPlan } from '../types';
import { buildWeekLabel, formatDayNameEs } from '../utils/dates';

export type SeedState = {
  employees: typeof mockEmployees;
  roles: typeof mockRoles;
  timeSlots: typeof mockTimeSlots;
  shiftRanges: ShiftRanges;
  validationRequirements: ValidationRequirements;
  weeks: ReturnType<typeof buildMockWeeks>;
  weekPlans: Record<string, WeekPlan>;
};

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
  const normalizedWeeks = baseWeeks.map((week, index) => {
    const weekPrefix = index === 0 ? 'Semana actual' : index === 1 ? 'Semana siguiente' : `En ${index} semanas`;
    return {
      ...week,
      label: `${weekPrefix} (${buildWeekLabel(parseISO(week.startDateISO))})`
    };
  });
  const weekPlans: Record<string, WeekPlan> = {};

  for (const week of normalizedWeeks) {
    const normalized = normalizeWeekPlan(week.startDateISO, input.weekPlans[week.id]);
    weekPlans[week.id] = {
      weekId: normalized.weekId || week.id,
      days: normalized.days
    };
  }

  const normalizedEmployees = normalizeEmployeeCodes(input.employees).map((employee) => normalizeEmployeeContract(employee));

  return {
    employees: normalizedEmployees,
    roles: input.roles,
    timeSlots: input.timeSlots,
    shiftRanges: normalizeShiftRanges(input.shiftRanges, input.timeSlots),
    validationRequirements: normalizeValidationRequirements(input.validationRequirements),
    weeks: normalizedWeeks,
    weekPlans
  };
}

export function loadSeedState(): SeedState {
  const employees = normalizeEmployeeCodes([...mockEmployees]);
  const roles = [...mockRoles];
  const timeSlots = [...mockTimeSlots];
  const shiftRanges = buildDefaultShiftRanges(timeSlots);
  const validationRequirements = buildDefaultValidationRequirements();
  const weeks = buildMockWeeks();
  const weekPlans: Record<string, WeekPlan> = {};

  const employeeIds = employees.map((employee) => employee.id);
  const timeSlotIds = timeSlots.map((timeSlot) => timeSlot.id);

  for (const week of weeks) {
    weekPlans[week.id] = buildEmptyWeekPlan(week, employeeIds, timeSlotIds);
  }

  return { employees, roles, timeSlots, shiftRanges, validationRequirements, weeks, weekPlans };
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
