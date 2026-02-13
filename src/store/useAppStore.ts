import { create } from 'zustand';
import { loadOrSeed } from '../data/seed';
import { buildEmptyWeekPlan } from '../data/mocks';
import type { Assignment, Employee, Role, Week } from '../types';
import { clearMvpStorage, persistEmployees, persistFullData, persistRoles, persistTimeSlots, persistWeekPlan, persistWeeks } from '../utils/storage';

type UpdateAssignmentInput = {
  weekId: string;
  dateISO: string;
  timeSlotId: string;
  employeeId: string;
  assignment: Assignment;
};

type AppState = ReturnType<typeof loadOrSeed> & {
  currentWeekId: string;
  setCurrentWeek: (weekId: string) => void;
  resetAll: () => void;
  upsertEmployee: (employee: Employee) => void;
  toggleEmployeeActive: (employeeId: string) => void;
  upsertRole: (role: Role) => { ok: boolean; error?: string };
  deleteRole: (roleId: string) => void;
  ensureWeekPlan: (week: Week) => void;
  updateAssignment: (input: UpdateAssignmentInput) => { ok: boolean; error?: string };
};

const seeded = loadOrSeed();

function validRoleCodes(roles: Role[]): Set<string> {
  return new Set(roles.flatMap((role) => role.validCodes.map((code) => `${role.id}|${code}`)));
}

export const useAppStore = create<AppState>((set, get) => ({
  ...seeded,
  currentWeekId: seeded.weeks[0]?.id ?? '',

  setCurrentWeek: (weekId) => set({ currentWeekId: weekId }),

  resetAll: () => {
    clearMvpStorage();
    const fresh = loadOrSeed();
    set({ ...fresh, currentWeekId: fresh.weeks[0]?.id ?? '' });
  },

  upsertEmployee: (employee) =>
    set((state) => {
      const exists = state.employees.some((item) => item.id === employee.id);
      const employees = exists
        ? state.employees.map((item) => (item.id === employee.id ? employee : item))
        : [...state.employees, employee];
      persistEmployees(employees);
      return { employees };
    }),

  toggleEmployeeActive: (employeeId) =>
    set((state) => {
      const employees = state.employees.map((employee) =>
        employee.id === employeeId ? { ...employee, active: !employee.active } : employee
      );
      persistEmployees(employees);
      return { employees };
    }),

  upsertRole: (role) => {
    const { roles } = get();
    const duplicate = roles
      .filter((current) => current.id !== role.id)
      .some((current) => current.validCodes.some((code) => role.validCodes.includes(code)));
    if (duplicate) return { ok: false, error: 'Hay códigos duplicados en otro puesto.' };

    set((state) => {
      const exists = state.roles.some((item) => item.id === role.id);
      const next = exists ? state.roles.map((item) => (item.id === role.id ? role : item)) : [...state.roles, role];
      persistRoles(next);
      return { roles: next };
    });
    return { ok: true };
  },

  deleteRole: (roleId) =>
    set((state) => {
      const roles = state.roles.filter((role) => role.id !== roleId);
      const weekPlans = { ...state.weekPlans };
      for (const [weekId, plan] of Object.entries(weekPlans)) {
        weekPlans[weekId] = {
          ...plan,
          days: plan.days.map((day) => {
            const assignments = { ...day.assignments };
            for (const [slotId, byEmployee] of Object.entries(assignments)) {
              assignments[slotId] = { ...byEmployee };
              for (const [employeeId, assignment] of Object.entries(assignments[slotId])) {
                if (assignment.roleId === roleId) {
                  assignments[slotId][employeeId] = { roleId: null, code: 'LIBRE' };
                }
              }
            }
            return { ...day, assignments };
          })
        };
        persistWeekPlan(weekId, weekPlans[weekId]);
      }
      persistRoles(roles);
      return { roles, weekPlans };
    }),

  ensureWeekPlan: (week) =>
    set((state) => {
      if (state.weekPlans[week.id]) return {};
      const weekPlans = { ...state.weekPlans };
      weekPlans[week.id] = buildEmptyWeekPlan(
        week,
        state.employees.map((employee) => employee.id),
        state.timeSlots.map((slot) => slot.id)
      );
      persistWeekPlan(week.id, weekPlans[week.id]);
      return { weekPlans };
    }),

  updateAssignment: ({ weekId, dateISO, timeSlotId, employeeId, assignment }) => {
    const { roles } = get();
    if (assignment.roleId === null && assignment.code !== 'LIBRE') {
      return { ok: false, error: 'LIBRE debe usar código LIBRE.' };
    }
    if (assignment.roleId !== null) {
      const accepted = validRoleCodes(roles).has(`${assignment.roleId}|${assignment.code}`);
      if (!accepted) return { ok: false, error: 'El código no pertenece al puesto seleccionado.' };
    }

    set((state) => {
      const plan = state.weekPlans[weekId];
      if (!plan) return {};
      const days = plan.days.map((day) => {
        if (day.dateISO !== dateISO) return day;
        const assignmentsBySlot = { ...day.assignments };
        const byEmployee = { ...(assignmentsBySlot[timeSlotId] ?? {}) };
        byEmployee[employeeId] = assignment;
        assignmentsBySlot[timeSlotId] = byEmployee;
        return { ...day, assignments: assignmentsBySlot };
      });
      const weekPlan = { ...plan, days };
      const weekPlans = { ...state.weekPlans, [weekId]: weekPlan };
      persistWeekPlan(weekId, weekPlan);
      return { weekPlans };
    });
    return { ok: true };
  }
}));

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function exportPersistSnapshot(): void {
  const state = useAppStore.getState();
  persistFullData({
    employees: state.employees,
    roles: state.roles,
    timeSlots: state.timeSlots,
    weeks: state.weeks,
    weekPlans: state.weekPlans
  });
}
