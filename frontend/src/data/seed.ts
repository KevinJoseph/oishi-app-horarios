import { addDays, formatISO, parseISO } from 'date-fns';
import { buildEmptyWeekPlan, buildMockWeeks, mockEmployees, mockRoles, mockTimeSlots } from './mocks';
import type { ShiftRanges, WeekPlan } from '../types';
import { buildWeekLabel, formatDayNameEs } from '../utils/dates';

export type SeedState = {
  employees: typeof mockEmployees;
  roles: typeof mockRoles;
  timeSlots: typeof mockTimeSlots;
  shiftRanges: ShiftRanges;
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

  const normalizedEmployees = input.employees.map((employee) => normalizeEmployeeContract(employee));

  return {
    employees: normalizedEmployees,
    roles: input.roles,
    timeSlots: input.timeSlots,
    shiftRanges: normalizeShiftRanges(input.shiftRanges, input.timeSlots),
    weeks: normalizedWeeks,
    weekPlans
  };
}

export function loadSeedState(): SeedState {
  const employees = [...mockEmployees];
  const roles = [...mockRoles];
  const timeSlots = [...mockTimeSlots];
  const shiftRanges = buildDefaultShiftRanges(timeSlots);
  const weeks = buildMockWeeks();
  const weekPlans: Record<string, WeekPlan> = {};

  const employeeIds = employees.map((employee) => employee.id);
  const timeSlotIds = timeSlots.map((timeSlot) => timeSlot.id);

  for (const week of weeks) {
    weekPlans[week.id] = buildEmptyWeekPlan(week, employeeIds, timeSlotIds);
  }

  return { employees, roles, timeSlots, shiftRanges, weeks, weekPlans };
}

function normalizeEmployeeContract(employee: SeedState['employees'][number]): SeedState['employees'][number] {
  return {
    ...employee,
    weeklyHours: Math.max(0, employee.weeklyHours ?? 0)
  };
}
