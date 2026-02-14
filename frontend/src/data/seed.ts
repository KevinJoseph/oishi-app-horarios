import { addDays, formatISO, parseISO } from 'date-fns';
import { buildEmptyWeekPlan, buildMockWeeks, mockEmployees, mockRoles, mockTimeSlots } from './mocks';
import type { WeekPlan } from '../types';
import { formatDayNameEs } from '../utils/dates';

export type SeedState = {
  employees: typeof mockEmployees;
  roles: typeof mockRoles;
  timeSlots: typeof mockTimeSlots;
  weeks: ReturnType<typeof buildMockWeeks>;
  weekPlans: Record<string, WeekPlan>;
};

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
  const weekPlans: Record<string, WeekPlan> = {};

  for (const week of input.weeks) {
    const normalized = normalizeWeekPlan(week.startDateISO, input.weekPlans[week.id]);
    weekPlans[week.id] = {
      weekId: normalized.weekId || week.id,
      days: normalized.days
    };
  }

  return {
    employees: input.employees,
    roles: input.roles,
    timeSlots: input.timeSlots,
    weeks: input.weeks,
    weekPlans
  };
}

export function loadSeedState(): SeedState {
  const employees = [...mockEmployees];
  const roles = [...mockRoles];
  const timeSlots = [...mockTimeSlots];
  const weeks = buildMockWeeks();
  const weekPlans: Record<string, WeekPlan> = {};

  const employeeIds = employees.map((employee) => employee.id);
  const timeSlotIds = timeSlots.map((timeSlot) => timeSlot.id);

  for (const week of weeks) {
    weekPlans[week.id] = buildEmptyWeekPlan(week, employeeIds, timeSlotIds);
  }

  return { employees, roles, timeSlots, weeks, weekPlans };
}
