import { addDays, formatISO, parseISO } from 'date-fns';
import { buildEmptyWeekPlan, buildMockWeeks, mockEmployees, mockRoles, mockTimeSlots } from './mocks';
import { loadPersistedData, persistFullData } from '../utils/storage';
import type { WeekPlan } from '../types';
import { formatDayNameEs } from '../utils/dates';

export type SeedState = {
  employees: typeof mockEmployees;
  roles: typeof mockRoles;
  timeSlots: typeof mockTimeSlots;
  weeks: ReturnType<typeof buildMockWeeks>;
  weekPlans: Record<string, WeekPlan>;
};

function normalizePersistedWeekPlan(weekStartDateISO: string, persisted: WeekPlan): WeekPlan {
  const start = parseISO(weekStartDateISO);
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const sourceDay = persisted.days[idx];
    const date = addDays(start, idx);
    const dateISO = formatISO(date, { representation: 'date' });
    return {
      dateISO,
      dayName: formatDayNameEs(dateISO),
      assignments: sourceDay?.assignments ?? {}
    };
  });
  return { weekId: persisted.weekId, days };
}

export function loadOrSeed(): SeedState {
  const persisted = loadPersistedData();
  if (persisted) {
    let changed = false;
    const weekPlans: Record<string, WeekPlan> = {};

    for (const week of persisted.weeks) {
      const plan = persisted.weekPlans[week.id];
      if (!plan) {
        changed = true;
        weekPlans[week.id] = buildEmptyWeekPlan(
          week,
          persisted.employees.map((employee) => employee.id),
          persisted.timeSlots.map((timeSlot) => timeSlot.id)
        );
        continue;
      }

      const normalized = normalizePersistedWeekPlan(week.startDateISO, plan);
      weekPlans[week.id] = normalized;
      if (plan.days[0]?.dateISO !== normalized.days[0]?.dateISO) changed = true;
    }

    const payload = { ...persisted, weekPlans };
    if (changed) persistFullData(payload);
    return payload;
  }

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

  const payload = { employees, roles, timeSlots, weeks, weekPlans };
  persistFullData(payload);
  return payload;
}
