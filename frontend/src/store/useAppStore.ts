import { create } from 'zustand';
import { fetchPlannerState, resetPlannerState as resetPlannerStateApi, savePlannerState } from '../api/plannerApi';
import { loadSeedState, normalizePlannerState } from '../data/seed';
import { buildEmptyWeekPlan } from '../data/mocks';
import type { Assignment, Employee, Role, Week } from '../types';

type UpdateAssignmentInput = {
  weekId: string;
  dateISO: string;
  timeSlotId: string;
  employeeId: string;
  assignment: Assignment;
};

type UpdateEmployeeDayAssignmentsInput = {
  weekId: string;
  dateISO: string;
  employeeId: string;
  assignment: Assignment;
  timeSlotIds: string[];
};

type PersistableState = ReturnType<typeof loadSeedState>;

type AppState = PersistableState & {
  currentWeekId: string;
  hydrated: boolean;
  syncError: string | null;
  initialize: () => Promise<void>;
  setCurrentWeek: (weekId: string) => void;
  resetAll: () => void;
  upsertEmployee: (employee: Employee) => void;
  toggleEmployeeActive: (employeeId: string) => void;
  upsertRole: (role: Role) => { ok: boolean; error?: string };
  deleteRole: (roleId: string) => void;
  ensureWeekPlan: (week: Week) => void;
  updateAssignment: (input: UpdateAssignmentInput) => { ok: boolean; error?: string };
  updateEmployeeDayAssignments: (input: UpdateEmployeeDayAssignmentsInput) => { ok: boolean; error?: string };
};

const seeded = loadSeedState();

function validRoleCodes(roles: Role[]): Set<string> {
  return new Set(roles.flatMap((role) => role.validCodes.map((code) => `${role.id}|${code}`)));
}

function toPersistableState(state: AppState): PersistableState {
  return {
    employees: state.employees,
    roles: state.roles,
    timeSlots: state.timeSlots,
    weeks: state.weeks,
    weekPlans: state.weekPlans
  };
}

function persistSnapshot(get: () => AppState, set: (partial: Partial<AppState>) => void): void {
  const snapshot = toPersistableState(get());
  void savePlannerState(snapshot)
    .then((serverState) => {
      const normalized = normalizePlannerState(serverState);
      set({
        ...normalized,
        syncError: null
      });
    })
    .catch((error) => {
      set({ syncError: error instanceof Error ? error.message : 'No se pudo sincronizar con el backend.' });
    });
}

export const useAppStore = create<AppState>((set, get) => ({
  ...seeded,
  currentWeekId: seeded.weeks[0]?.id ?? '',
  hydrated: false,
  syncError: null,

  initialize: async () => {
    if (get().hydrated) return;

    try {
      const remote = await fetchPlannerState();
      const normalized = normalizePlannerState(remote);
      set({
        ...normalized,
        currentWeekId: normalized.weeks[0]?.id ?? '',
        hydrated: true,
        syncError: null
      });
    } catch (error) {
      set({
        hydrated: true,
        syncError: error instanceof Error ? error.message : 'No se pudo cargar el backend. Se usa estado local temporal.'
      });
    }
  },

  setCurrentWeek: (weekId) => set({ currentWeekId: weekId }),

  resetAll: () => {
    set({ ...seeded, currentWeekId: seeded.weeks[0]?.id ?? '' });
    void resetPlannerStateApi()
      .then((fresh) => {
        const normalized = normalizePlannerState(fresh);
        set({
          ...normalized,
          currentWeekId: normalized.weeks[0]?.id ?? '',
          syncError: null
        });
      })
      .catch((error) => {
        set({ syncError: error instanceof Error ? error.message : 'No se pudo resetear en backend.' });
      });
  },

  upsertEmployee: (employee) => {
    set((state) => {
      const exists = state.employees.some((item) => item.id === employee.id);
      const employees = exists
        ? state.employees.map((item) => (item.id === employee.id ? employee : item))
        : [...state.employees, employee];
      return { employees };
    });
    persistSnapshot(get, set);
  },

  toggleEmployeeActive: (employeeId) => {
    set((state) => {
      const employees = state.employees.map((employee) =>
        employee.id === employeeId ? { ...employee, active: !employee.active } : employee
      );
      return { employees };
    });
    persistSnapshot(get, set);
  },

  upsertRole: (role) => {
    const { roles } = get();
    const duplicate = roles
      .filter((current) => current.id !== role.id)
      .some((current) => current.validCodes.some((code) => role.validCodes.includes(code)));
    if (duplicate) return { ok: false, error: 'Hay códigos duplicados en otro Zona.' };

    set((state) => {
      const exists = state.roles.some((item) => item.id === role.id);
      const next = exists ? state.roles.map((item) => (item.id === role.id ? role : item)) : [...state.roles, role];
      return { roles: next };
    });
    persistSnapshot(get, set);
    return { ok: true };
  },

  deleteRole: (roleId) => {
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
      }
      return { roles, weekPlans };
    });
    persistSnapshot(get, set);
  },

  ensureWeekPlan: (week) => {
    let created = false;
    set((state) => {
      if (state.weekPlans[week.id]) return {};
      const weekPlans = { ...state.weekPlans };
      weekPlans[week.id] = buildEmptyWeekPlan(
        week,
        state.employees.map((employee) => employee.id),
        state.timeSlots.map((slot) => slot.id)
      );
      created = true;
      return { weekPlans };
    });

    if (created) {
      persistSnapshot(get, set);
    }
  },

  updateAssignment: ({ weekId, dateISO, timeSlotId, employeeId, assignment }) => {
    const { roles } = get();
    if (assignment.roleId === null && assignment.code !== 'LIBRE') {
      return { ok: false, error: 'LIBRE debe usar código LIBRE.' };
    }
    if (assignment.roleId !== null) {
      const accepted = validRoleCodes(roles).has(`${assignment.roleId}|${assignment.code}`);
      if (!accepted) return { ok: false, error: 'El código no pertenece al Zona seleccionado.' };
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
      return { weekPlans };
    });
    persistSnapshot(get, set);
    return { ok: true };
  },

  updateEmployeeDayAssignments: ({ weekId, dateISO, employeeId, assignment, timeSlotIds }) => {
    const { roles } = get();
    if (assignment.roleId === null && assignment.code !== 'LIBRE') {
      return { ok: false, error: 'LIBRE debe usar código LIBRE.' };
    }
    if (assignment.roleId !== null) {
      const accepted = validRoleCodes(roles).has(`${assignment.roleId}|${assignment.code}`);
      if (!accepted) return { ok: false, error: 'El código no pertenece al Zona seleccionado.' };
    }

    set((state) => {
      const plan = state.weekPlans[weekId];
      if (!plan) return {};
      const days = plan.days.map((day) => {
        if (day.dateISO !== dateISO) return day;
        const assignmentsBySlot = { ...day.assignments };
        for (const timeSlotId of timeSlotIds) {
          const byEmployee = { ...(assignmentsBySlot[timeSlotId] ?? {}) };
          byEmployee[employeeId] = assignment;
          assignmentsBySlot[timeSlotId] = byEmployee;
        }
        return { ...day, assignments: assignmentsBySlot };
      });
      const weekPlan = { ...plan, days };
      const weekPlans = { ...state.weekPlans, [weekId]: weekPlan };
      return { weekPlans };
    });
    persistSnapshot(get, set);
    return { ok: true };
  }
}));

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}-${Date.now().toString(36)}`;
}

export async function exportPersistSnapshot(): Promise<void> {
  const state = useAppStore.getState();
  await savePlannerState(toPersistableState(state));
}
