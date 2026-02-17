import { addDays, formatISO, parseISO } from 'date-fns';
import { buildEmptyWeekPlan, buildMockWeeks, mockEmployees, mockRoles, mockTimeSlots } from './mocks';
import type { WeekPlan } from '../types';
import { buildWeekLabel, formatDayNameEs } from '../utils/dates';

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
    weeks: normalizedWeeks,
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

function normalizeEmployeeContract(employee: SeedState['employees'][number]): SeedState['employees'][number] {
  if ((employee.contractType === 'full-time' || employee.contractType === 'part-time') && (employee.weeklyHours ?? 0) <= 0) {
    return {
      ...employee,
      contractType: undefined,
      shiftType: undefined,
      weeklyHours: 0
    };
  }
  if (employee.contractType === 'full-time') {
    return { ...employee, weeklyHours: 56 };
  }
  if (employee.contractType === 'part-time') {
    return { ...employee, weeklyHours: 28 };
  }
  return {
    ...employee,
    contractType: undefined,
    shiftType: undefined,
    weeklyHours: 0
  };
}
