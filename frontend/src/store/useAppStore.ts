import { create } from 'zustand';
import { fetchPlannerState, resetPlannerState as resetPlannerStateApi, savePlannerState } from '../api/plannerApi';
import { loadSeedState, normalizePlannerState } from '../data/seed';
import { buildEmptyWeekPlan } from '../data/mocks';
import type { Assignment, Employee, Role, ShiftRanges, TimeSlot, ValidationRequirements, Week, WeekAudit, WeekPlan } from '../types';
import { normalizeRestDay } from '../utils/weekdays';

type UpdateAssignmentInput = {
  weekId: string;
  dateISO: string;
  timeSlotId: string;
  employeeId: string;
  assignment: Assignment;
  actorName?: string;
};

type UpdateEmployeeDayAssignmentsInput = {
  weekId: string;
  dateISO: string;
  employeeId: string;
  assignment: Assignment;
  timeSlotIds: string[];
  actorName?: string;
};

type UpdateEmployeeDayByHoursInput = {
  weekId: string;
  dateISO: string;
  employeeId: string;
  assignment: Assignment;
  hours: number;
  actorName?: string;
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
  deleteEmployee: (employeeId: string) => void;
  upsertRole: (role: Role) => { ok: boolean; error?: string };
  deleteRole: (roleId: string) => void;
  ensureWeekPlan: (week: Week) => void;
  updateAssignment: (input: UpdateAssignmentInput) => { ok: boolean; error?: string };
  updateEmployeeDayAssignments: (input: UpdateEmployeeDayAssignmentsInput) => { ok: boolean; error?: string };
  updateEmployeeDayByHours: (input: UpdateEmployeeDayByHoursInput) => { ok: boolean; error?: string };
  validateWeekPlan: (weekId: string, actorName?: string) => { ok: boolean; error?: string };
  desvalidateWeekPlan: (weekId: string) => { ok: boolean; error?: string };
  setPlanningHoursRange: (startHour: number, endHour: number) => { ok: boolean; error?: string };
  setShiftRanges: (input: ShiftRanges) => { ok: boolean; error?: string };
  setValidationRequirements: (input: ValidationRequirements) => { ok: boolean; error?: string };
};

const seeded = loadSeedState();

function validRoleCodes(roles: Role[]): Set<string> {
  return new Set(roles.flatMap((role) => role.validCodes.map((code) => `${role.id}|${code}`)));
}

function getNextEmployeeCode(employees: Employee[]): string {
  let maxCode = 0;
  for (const employee of employees) {
    const match = employee.code?.trim().match(/^CO-(\d+)$/i);
    if (!match) continue;
    const numeric = Number.parseInt(match[1], 10);
    if (Number.isInteger(numeric) && numeric > maxCode) {
      maxCode = numeric;
    }
  }
  return `CO-${String(maxCode + 1).padStart(2, '0')}`;
}

function buildAutoWeekPlanForEmployee(
  plan: WeekPlan,
  employeeId: string,
  roleId: string,
  weeklyHours: number,
  restDay: number,
  shiftType: Employee['shiftType'],
  shiftRanges: ShiftRanges,
  timeSlots: TimeSlot[],
  roles: Role[]
): WeekPlan {
  const role = roles.find((item) => item.id === roleId);
  const code = role?.validCodes[0];
  if (!code) return clearEmployeeFromWeekPlan(plan, employeeId, timeSlots);

  const assignableSlots = getAssignableTimeSlots(timeSlots);
  const preferredPlanningSlots = getAutoPlanningTimeSlots(timeSlots, shiftType, shiftRanges);
  const workingDays = plan.days.filter((day) => parseISODateToDay(day.dateISO) !== restDay).length;
  const preferredDailyHours = preferredPlanningSlots.reduce(
    (sum, slot) => sum + getSlotDurationHours(slot.start, slot.end),
    0
  );
  // Si el rango del turno no cubre las horas semanales, ampliamos a todos los bloques.
  const effectivePlanningSlots =
    preferredDailyHours * workingDays >= Math.max(0, weeklyHours) ? preferredPlanningSlots : assignableSlots;
  const planningSlotIds = new Set(effectivePlanningSlots.map((slot) => slot.id));
  const slotHoursById = new Map(effectivePlanningSlots.map((slot) => [slot.id, getSlotDurationHours(slot.start, slot.end)]));
  let remainingHours = Math.max(0, weeklyHours);

  const days = plan.days.map((day) => {
    const assignments = { ...day.assignments };
    const isRestDay = parseISODateToDay(day.dateISO) === restDay;
    for (const slot of assignableSlots) {
      const byEmployee = { ...(assignments[slot.id] ?? {}) };
      const isPlanningSlot = planningSlotIds.has(slot.id);
      const slotHours = slotHoursById.get(slot.id) ?? 0;

      if (isPlanningSlot && !isRestDay && remainingHours > 0 && slotHours > 0) {
        byEmployee[employeeId] = { roleId, code };
        remainingHours = Number((remainingHours - slotHours).toFixed(4));
      } else {
        byEmployee[employeeId] = { roleId: null, code: 'LIBRE' };
      }

      assignments[slot.id] = byEmployee;
    }
    return { ...day, assignments };
  });

  return { ...plan, days };
}

function rebuildWeekPlansFromEmployees(
  weekPlans: Record<string, WeekPlan>,
  employees: Employee[],
  roles: Role[],
  timeSlots: TimeSlot[],
  shiftRanges: ShiftRanges
): Record<string, WeekPlan> {
  const roleIds = new Set(roles.map((role) => role.id));
  const next: Record<string, WeekPlan> = {};

  for (const [weekId, weekPlan] of Object.entries(weekPlans)) {
    let plan = weekPlan;

    for (const employee of employees) {
      const weeklyHours = Math.max(0, employee.weeklyHours ?? 0);
      const hasMainRole = Boolean(employee.mainRoleId && roleIds.has(employee.mainRoleId));
      const shouldAutoAssign = employee.active && hasMainRole && weeklyHours > 0;

      if (!shouldAutoAssign) {
        plan = clearEmployeeFromWeekPlan(plan, employee.id, timeSlots);
        continue;
      }

      plan = buildAutoWeekPlanForEmployee(
        plan,
        employee.id,
        employee.mainRoleId as string,
        weeklyHours,
        normalizeRestDay(employee.restDay),
        employee.shiftType,
        shiftRanges,
        timeSlots,
        roles
      );
    }

    next[weekId] = plan;
  }

  return next;
}

function getAssignableTimeSlots(timeSlots: TimeSlot[]): TimeSlot[] {
  return [...timeSlots].sort((a, b) => a.order - b.order);
}

function getAutoPlanningTimeSlots(
  timeSlots: TimeSlot[],
  shiftType: Employee['shiftType'],
  shiftRanges: ShiftRanges
): TimeSlot[] {
  const assignable = getAssignableTimeSlots(timeSlots);
  if (!shiftType) return assignable;
  const range = shiftType === 'night' ? shiftRanges.night : shiftRanges.day;
  const start = range.startHour * 60;
  const end = range.endHour * 60;
  return assignable.filter((slot) => {
    const slotStart = parseTimeToMinutes(slot.start);
    const slotEnd = parseTimeToMinutes(slot.end);
    if (slotStart === null || slotEnd === null) return false;
    return slotStart >= start && slotEnd <= end;
  });
}

function clearEmployeeFromWeekPlan(plan: WeekPlan, employeeId: string, timeSlots: TimeSlot[]): WeekPlan {
  const slotIds = timeSlots.map((slot) => slot.id);
  const days = plan.days.map((day) => {
    const assignments = { ...day.assignments };
    for (const slotId of slotIds) {
      const byEmployee = { ...(assignments[slotId] ?? {}) };
      byEmployee[employeeId] = { roleId: null, code: 'LIBRE' };
      assignments[slotId] = byEmployee;
    }
    return { ...day, assignments };
  });
  return { ...plan, days };
}

function getSlotDurationHours(start: string, end: string): number {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return 0;
  return (endMinutes - startMinutes) / 60;
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function parseISODateToDay(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00`).getDay();
}

function invalidateWeekValidation(validatedWeekIds: string[], weekId: string): string[] {
  return validatedWeekIds.filter((validatedWeekId) => validatedWeekId !== weekId);
}

function ensureWeekCreator(
  weekAuditById: Record<string, WeekAudit>,
  weekId: string,
  actorName?: string
): Record<string, WeekAudit> {
  const current = weekAuditById[weekId] ?? { createdByName: null, validatedByName: null };
  if (current.createdByName) {
    return weekAuditById;
  }
  return {
    ...weekAuditById,
    [weekId]: {
      ...current,
      createdByName: actorName?.trim() || 'No registrado'
    }
  };
}

function clearWeekValidator(weekAuditById: Record<string, WeekAudit>, weekId: string): Record<string, WeekAudit> {
  const current = weekAuditById[weekId] ?? { createdByName: null, validatedByName: null };
  if (!current.validatedByName) {
    return weekAuditById;
  }
  return {
    ...weekAuditById,
    [weekId]: {
      ...current,
      validatedByName: null
    }
  };
}

function clearAllWeekValidators(weekAuditById: Record<string, WeekAudit>): Record<string, WeekAudit> {
  let changed = false;
  const next: Record<string, WeekAudit> = {};
  for (const [weekId, audit] of Object.entries(weekAuditById)) {
    if (audit.validatedByName) changed = true;
    next[weekId] = {
      ...audit,
      validatedByName: null
    };
  }
  return changed ? next : weekAuditById;
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function buildTimeSlotsFromHourRange(startHour: number, endHour: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  let order = 1;
  for (let hour = startHour; hour < endHour; hour += 1) {
    const start = formatHourLabel(hour);
    const end = formatHourLabel(hour + 1);
    slots.push({
      id: `ts-${start.replace(':', '')}-${end.replace(':', '')}`,
      label: `${start} - ${end}`,
      start,
      end,
      order
    });
    order += 1;
  }
  return slots;
}

function buildDefaultShiftRanges(startHour: number, endHour: number): ShiftRanges {
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

function getPlanningHoursBounds(timeSlots: TimeSlot[]): { startHour: number; endHour: number } {
  const ordered = [...timeSlots].sort((a, b) => a.order - b.order);
  const startHour = Number.parseInt(ordered[0]?.start.slice(0, 2) ?? '12', 10);
  const endHour = Number.parseInt(ordered[ordered.length - 1]?.end.slice(0, 2) ?? '22', 10);
  return { startHour, endHour };
}

function normalizeShiftRangesToPlanningBounds(
  ranges: ShiftRanges,
  planningStartHour: number,
  planningEndHour: number
): ShiftRanges {
  const isValid = (value: { startHour: number; endHour: number }) =>
    Number.isInteger(value.startHour) &&
    Number.isInteger(value.endHour) &&
    value.startHour >= planningStartHour &&
    value.endHour <= planningEndHour &&
    value.endHour > value.startHour;

  if (isValid(ranges.day) && isValid(ranges.night)) {
    return ranges;
  }
  return buildDefaultShiftRanges(planningStartHour, planningEndHour);
}

function remapWeekPlansToTimeSlots(
  weekPlans: Record<string, WeekPlan>,
  timeSlots: TimeSlot[],
  employeeIds: string[]
): Record<string, WeekPlan> {
  const next: Record<string, WeekPlan> = {};

  for (const [weekId, plan] of Object.entries(weekPlans)) {
    next[weekId] = {
      ...plan,
      days: plan.days.map((day) => {
        const assignments: WeekPlan['days'][number]['assignments'] = {};
        for (const slot of timeSlots) {
          const existing = day.assignments[slot.id];
          if (existing) {
            assignments[slot.id] = existing;
            continue;
          }

          const byEmployee: WeekPlan['days'][number]['assignments'][string] = {};
          for (const employeeId of employeeIds) {
            byEmployee[employeeId] = { roleId: null, code: 'LIBRE' };
          }
          assignments[slot.id] = byEmployee;
        }

        return { ...day, assignments };
      })
    };
  }

  return next;
}

function toPersistableState(state: AppState): PersistableState {
  return {
    employees: state.employees,
    roles: state.roles,
    timeSlots: state.timeSlots,
    shiftRanges: state.shiftRanges,
    validationRequirements: state.validationRequirements,
    weeks: state.weeks,
    weekPlans: state.weekPlans,
    validatedWeekIds: state.validatedWeekIds,
    weekAuditById: state.weekAuditById
  };
}

let persistInFlight = false;
let persistQueued = false;

async function flushPersistQueue(get: () => AppState, set: (partial: Partial<AppState>) => void): Promise<void> {
  if (persistInFlight) return;
  persistInFlight = true;
  try {
    while (persistQueued) {
      persistQueued = false;
      const snapshot = toPersistableState(get());
      try {
        const serverState = await savePlannerState(snapshot);
        const normalized = normalizePlannerState(serverState);
        set({
          ...normalized,
          syncError: null
        });
      } catch (error) {
        set({ syncError: error instanceof Error ? error.message : 'No se pudo sincronizar con el backend.' });
      }
    }
  } finally {
    persistInFlight = false;
  }
}

function persistSnapshot(get: () => AppState, set: (partial: Partial<AppState>) => void): void {
  persistQueued = true;
  void flushPersistQueue(get, set);
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
      const previous = state.employees.find((item) => item.id === employee.id);
      const normalizedEmployee: Employee = {
        ...employee,
        restDay: normalizeRestDay(employee.restDay),
        code: employee.code ?? previous?.code ?? getNextEmployeeCode(state.employees)
      };
      const exists = Boolean(previous);
      const employees = exists
        ? state.employees.map((item) => (item.id === normalizedEmployee.id ? normalizedEmployee : item))
        : [...state.employees, normalizedEmployee];

      const planningChanged =
        !previous ||
        previous.mainRoleId !== normalizedEmployee.mainRoleId ||
        previous.weeklyHours !== normalizedEmployee.weeklyHours ||
        previous.restDay !== normalizedEmployee.restDay ||
        previous.contractType !== normalizedEmployee.contractType ||
        previous.shiftType !== normalizedEmployee.shiftType ||
        previous.active !== normalizedEmployee.active;

      if (!planningChanged) {
        return { employees };
      }

      const currentWeekId = state.currentWeekId;
      const currentWeekPlan = state.weekPlans[currentWeekId];
      if (!currentWeekPlan) {
        return { employees };
      }

      const weeklyHours = Math.max(0, normalizedEmployee.weeklyHours ?? 0);
      const restDay = normalizeRestDay(normalizedEmployee.restDay);
      const roleExists = Boolean(
        normalizedEmployee.mainRoleId && state.roles.some((role) => role.id === normalizedEmployee.mainRoleId)
      );

      const nextWeekPlan =
        !normalizedEmployee.active || !roleExists || weeklyHours <= 0
          ? clearEmployeeFromWeekPlan(currentWeekPlan, normalizedEmployee.id, state.timeSlots)
          : buildAutoWeekPlanForEmployee(
              currentWeekPlan,
              normalizedEmployee.id,
              normalizedEmployee.mainRoleId as string,
              weeklyHours,
              restDay,
              normalizedEmployee.shiftType,
              state.shiftRanges,
              state.timeSlots,
              state.roles
            );

      const weekPlans = {
        ...state.weekPlans,
        [currentWeekId]: nextWeekPlan
      };

      return {
        employees,
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, currentWeekId),
        weekAuditById: clearWeekValidator(state.weekAuditById, currentWeekId)
      };
    });
    persistSnapshot(get, set);
  },

  deleteEmployee: (employeeId) => {
    set((state) => {
      const employees = state.employees.filter((employee) => employee.id !== employeeId);
      const weekPlans: Record<string, WeekPlan> = {};

      for (const [weekId, plan] of Object.entries(state.weekPlans)) {
        weekPlans[weekId] = {
          ...plan,
          days: plan.days.map((day) => {
            const assignments = { ...day.assignments };
            for (const [slotId, byEmployee] of Object.entries(assignments)) {
              const nextByEmployee = { ...byEmployee };
              delete nextByEmployee[employeeId];
              assignments[slotId] = nextByEmployee;
            }
            return { ...day, assignments };
          })
        };
      }

      return { employees, weekPlans, validatedWeekIds: [], weekAuditById: clearAllWeekValidators(state.weekAuditById) };
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
      return { roles: next, validatedWeekIds: [], weekAuditById: clearAllWeekValidators(state.weekAuditById) };
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
      return { roles, weekPlans, validatedWeekIds: [], weekAuditById: clearAllWeekValidators(state.weekAuditById) };
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
      return {
        weekPlans,
        weekAuditById: {
          ...state.weekAuditById,
          [week.id]: { createdByName: null, validatedByName: null }
        }
      };
    });

    if (created) {
      persistSnapshot(get, set);
    }
  },

  updateAssignment: ({ weekId, dateISO, timeSlotId, employeeId, assignment, actorName }) => {
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
      return {
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, weekId),
        weekAuditById: clearWeekValidator(ensureWeekCreator(state.weekAuditById, weekId, actorName), weekId)
      };
    });
    persistSnapshot(get, set);
    return { ok: true };
  },

  updateEmployeeDayAssignments: ({ weekId, dateISO, employeeId, assignment, timeSlotIds, actorName }) => {
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
      return {
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, weekId),
        weekAuditById: clearWeekValidator(ensureWeekCreator(state.weekAuditById, weekId, actorName), weekId)
      };
    });
    persistSnapshot(get, set);
    return { ok: true };
  },

  updateEmployeeDayByHours: ({ weekId, dateISO, employeeId, assignment, hours, actorName }) => {
    const { roles, timeSlots } = get();
    if (assignment.roleId === null && assignment.code !== 'LIBRE') {
      return { ok: false, error: 'LIBRE debe usar código LIBRE.' };
    }
    if (assignment.roleId !== null) {
      const accepted = validRoleCodes(roles).has(`${assignment.roleId}|${assignment.code}`);
      if (!accepted) return { ok: false, error: 'El código no pertenece al Zona seleccionado.' };
    }
    if (!Number.isFinite(hours) || hours < 0) {
      return { ok: false, error: 'Las horas deben ser un número mayor o igual a 0.' };
    }

    set((state) => {
      const plan = state.weekPlans[weekId];
      if (!plan) return {};
      const orderedSlotIds = getAssignableTimeSlots(timeSlots).map((slot) => slot.id);

      const days = plan.days.map((day) => {
        if (day.dateISO !== dateISO) return day;
        let remaining = hours;
        const assignmentsBySlot = { ...day.assignments };

        for (const timeSlotId of orderedSlotIds) {
          const byEmployee = { ...(assignmentsBySlot[timeSlotId] ?? {}) };
          const slot = timeSlots.find((item) => item.id === timeSlotId);
          const slotHours = slot ? getSlotDurationHours(slot.start, slot.end) : 0;
          const shouldApplyInSlot = remaining > 0 && slotHours > 0;

          if (assignment.roleId === null) {
            // LIBRE + N horas: solo libera los primeros N bloques y mantiene intacto el resto del día.
            if (shouldApplyInSlot) {
              byEmployee[employeeId] = { roleId: null, code: 'LIBRE' };
              assignmentsBySlot[timeSlotId] = byEmployee;
              remaining = Number((remaining - slotHours).toFixed(4));
            }
            continue;
          }

          // Zona + N horas: asigna los primeros N bloques y libera el resto del día.
          byEmployee[employeeId] = shouldApplyInSlot ? assignment : { roleId: null, code: 'LIBRE' };
          assignmentsBySlot[timeSlotId] = byEmployee;

          if (shouldApplyInSlot) {
            remaining = Number((remaining - slotHours).toFixed(4));
          }
        }

        return { ...day, assignments: assignmentsBySlot };
      });

      const weekPlan = { ...plan, days };
      const weekPlans = { ...state.weekPlans, [weekId]: weekPlan };
      return {
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, weekId),
        weekAuditById: clearWeekValidator(ensureWeekCreator(state.weekAuditById, weekId, actorName), weekId)
      };
    });
    persistSnapshot(get, set);
    return { ok: true };
  },

  setPlanningHoursRange: (startHour, endHour) => {
    if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) {
      return { ok: false, error: 'El rango debe usar horas enteras.' };
    }
    if (startHour < 0 || startHour > 22 || endHour < 1 || endHour > 23) {
      return { ok: false, error: 'El rango debe estar entre 00:00 y 23:00.' };
    }
    if (endHour <= startHour) {
      return { ok: false, error: 'La hora fin debe ser mayor que la hora inicio.' };
    }

    const nextTimeSlots = buildTimeSlotsFromHourRange(startHour, endHour);
    if (!nextTimeSlots.length) {
      return { ok: false, error: 'El rango seleccionado no genera bloques.' };
    }

    set((state) => {
      const employeeIds = state.employees.map((employee) => employee.id);
      const remappedWeekPlans = remapWeekPlansToTimeSlots(state.weekPlans, nextTimeSlots, employeeIds);
      const normalizedShiftRanges = normalizeShiftRangesToPlanningBounds(state.shiftRanges, startHour, endHour);
      const rebuiltWeekPlans = rebuildWeekPlansFromEmployees(
        remappedWeekPlans,
        state.employees,
        state.roles,
        nextTimeSlots,
        normalizedShiftRanges
      );
      return {
        timeSlots: nextTimeSlots,
        shiftRanges: normalizedShiftRanges,
        weekPlans: rebuiltWeekPlans,
        validatedWeekIds: [],
        weekAuditById: clearAllWeekValidators(state.weekAuditById)
      };
    });
    persistSnapshot(get, set);
    return { ok: true };
  },

  setShiftRanges: (input) => {
    const { timeSlots } = get();
    const { startHour, endHour } = getPlanningHoursBounds(timeSlots);
    const normalized = normalizeShiftRangesToPlanningBounds(input, startHour, endHour);
    const inputChanged =
      normalized.day.startHour !== input.day.startHour ||
      normalized.day.endHour !== input.day.endHour ||
      normalized.night.startHour !== input.night.startHour ||
      normalized.night.endHour !== input.night.endHour;

    if (inputChanged) {
      return { ok: false, error: 'Los turnos deben estar dentro del rango de planificación y tener inicio/fin válido.' };
    }

    set((state) => {
      const weekPlans = rebuildWeekPlansFromEmployees(
        state.weekPlans,
        state.employees,
        state.roles,
        state.timeSlots,
        normalized
      );
      return { shiftRanges: normalized, weekPlans, validatedWeekIds: [], weekAuditById: clearAllWeekValidators(state.weekAuditById) };
    });
    persistSnapshot(get, set);
    return { ok: true };
  },

  setValidationRequirements: (input) => {
    const sanitized: ValidationRequirements = {
      0: {
        opening: Number.isFinite(input[0]?.opening) ? Math.max(0, Math.trunc(input[0].opening)) : 0,
        closing: Number.isFinite(input[0]?.closing) ? Math.max(0, Math.trunc(input[0].closing)) : 0
      },
      1: {
        opening: Number.isFinite(input[1]?.opening) ? Math.max(0, Math.trunc(input[1].opening)) : 0,
        closing: Number.isFinite(input[1]?.closing) ? Math.max(0, Math.trunc(input[1].closing)) : 0
      },
      2: {
        opening: Number.isFinite(input[2]?.opening) ? Math.max(0, Math.trunc(input[2].opening)) : 0,
        closing: Number.isFinite(input[2]?.closing) ? Math.max(0, Math.trunc(input[2].closing)) : 0
      },
      3: {
        opening: Number.isFinite(input[3]?.opening) ? Math.max(0, Math.trunc(input[3].opening)) : 0,
        closing: Number.isFinite(input[3]?.closing) ? Math.max(0, Math.trunc(input[3].closing)) : 0
      },
      4: {
        opening: Number.isFinite(input[4]?.opening) ? Math.max(0, Math.trunc(input[4].opening)) : 0,
        closing: Number.isFinite(input[4]?.closing) ? Math.max(0, Math.trunc(input[4].closing)) : 0
      },
      5: {
        opening: Number.isFinite(input[5]?.opening) ? Math.max(0, Math.trunc(input[5].opening)) : 0,
        closing: Number.isFinite(input[5]?.closing) ? Math.max(0, Math.trunc(input[5].closing)) : 0
      },
      6: {
        opening: Number.isFinite(input[6]?.opening) ? Math.max(0, Math.trunc(input[6].opening)) : 0,
        closing: Number.isFinite(input[6]?.closing) ? Math.max(0, Math.trunc(input[6].closing)) : 0
      }
    };

    set((state) => ({
      validationRequirements: sanitized,
      validatedWeekIds: [],
      weekAuditById: clearAllWeekValidators(state.weekAuditById)
    }));
    persistSnapshot(get, set);
    return { ok: true };
  },

  validateWeekPlan: (weekId, actorName) => {
    if (!weekId.trim()) {
      return { ok: false, error: 'Semana inválida para validar.' };
    }

    set((state) => {
      if (!state.weekPlans[weekId]) return {};
      if (state.validatedWeekIds.includes(weekId)) return {};
      const auditWithCreator = ensureWeekCreator(state.weekAuditById, weekId, actorName);
      const currentAudit = auditWithCreator[weekId] ?? { createdByName: null, validatedByName: null };
      return {
        validatedWeekIds: [...state.validatedWeekIds, weekId],
        weekAuditById: {
          ...auditWithCreator,
          [weekId]: {
            ...currentAudit,
            validatedByName: actorName?.trim() || 'No registrado'
          }
        }
      };
    });
    persistSnapshot(get, set);
    return { ok: true };
  },

  desvalidateWeekPlan: (weekId) => {
    if (!weekId.trim()) {
      return { ok: false, error: 'Semana inválida para retornar validación.' };
    }

    set((state) => {
      if (!state.weekPlans[weekId]) return {};
      if (!state.validatedWeekIds.includes(weekId)) return {};
      return {
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, weekId),
        weekAuditById: clearWeekValidator(state.weekAuditById, weekId)
      };
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
