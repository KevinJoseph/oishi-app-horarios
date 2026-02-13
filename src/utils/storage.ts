import type { Employee, Role, TimeSlot, Week, WeekPlan } from '../types';

const EMPLOYEES_KEY = 'mvp:employees';
const ROLES_KEY = 'mvp:roles';
const TIMESLOTS_KEY = 'mvp:timeSlots';
const WEEKS_KEY = 'mvp:weeks';
const WEEKPLAN_PREFIX = 'mvp:weekPlan:';

type SeedPayload = {
  employees: Employee[];
  roles: Role[];
  timeSlots: TimeSlot[];
  weeks: Week[];
  weekPlans: Record<string, WeekPlan>;
};

function parseOrNull<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadPersistedData(): SeedPayload | null {
  const employees = parseOrNull<Employee[]>(localStorage.getItem(EMPLOYEES_KEY));
  const roles = parseOrNull<Role[]>(localStorage.getItem(ROLES_KEY));
  const timeSlots = parseOrNull<TimeSlot[]>(localStorage.getItem(TIMESLOTS_KEY));
  const weeks = parseOrNull<Week[]>(localStorage.getItem(WEEKS_KEY));
  if (!employees || !roles || !timeSlots || !weeks) return null;

  const weekPlans: Record<string, WeekPlan> = {};
  for (const week of weeks) {
    const plan = parseOrNull<WeekPlan>(localStorage.getItem(`${WEEKPLAN_PREFIX}${week.id}`));
    if (plan) weekPlans[week.id] = plan;
  }

  return { employees, roles, timeSlots, weeks, weekPlans };
}

export function persistEmployees(employees: Employee[]): void {
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
}

export function persistRoles(roles: Role[]): void {
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
}

export function persistTimeSlots(timeSlots: TimeSlot[]): void {
  localStorage.setItem(TIMESLOTS_KEY, JSON.stringify(timeSlots));
}

export function persistWeeks(weeks: Week[]): void {
  localStorage.setItem(WEEKS_KEY, JSON.stringify(weeks));
}

export function persistWeekPlan(weekId: string, weekPlan: WeekPlan): void {
  localStorage.setItem(`${WEEKPLAN_PREFIX}${weekId}`, JSON.stringify(weekPlan));
}

export function persistFullData(payload: SeedPayload): void {
  persistEmployees(payload.employees);
  persistRoles(payload.roles);
  persistTimeSlots(payload.timeSlots);
  persistWeeks(payload.weeks);
  Object.entries(payload.weekPlans).forEach(([weekId, weekPlan]) => persistWeekPlan(weekId, weekPlan));
}

export function clearMvpStorage(): void {
  const removable: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (
      key === EMPLOYEES_KEY ||
      key === ROLES_KEY ||
      key === TIMESLOTS_KEY ||
      key === WEEKS_KEY ||
      key.startsWith(WEEKPLAN_PREFIX)
    ) {
      removable.push(key);
    }
  }
  removable.forEach((key) => localStorage.removeItem(key));
}
