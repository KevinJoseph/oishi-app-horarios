import { create } from 'zustand';
import { addMonths, addWeeks, formatISO, parseISO } from 'date-fns';
import {
  fetchPlannerState,
  resetPlannerState as resetPlannerStateApi,
  savePlannerState,
  savePlannerStatePartial
} from '../api/plannerApi';
import { loadSeedState, normalizePlannerState } from '../data/seed';
import { buildEmptyWeekPlan, buildWeekFromStartDate } from '../data/mocks';
import { getBreakTimeSlotIds, getWorkableTimeSlots, isTimeSlotInBreak } from '../utils/breaks';
import { createBreakAssignment, createFreeAssignment, isBreakAssignment } from '../utils/assignments';
import type {
  AreaId,
  AreaInfo,
  Assignment,
  BreakConfig,
  Employee,
  Role,
  ShiftRanges,
  TimeSlot,
  ValidationRequirements,
  Week,
  WeekConfigurationSnapshot,
  WeekAudit,
  WeekPlan
} from '../types';
import { getCurrentWeekStartDateISO } from '../utils/dates';
import { normalizeRestDay } from '../utils/weekdays';
import { useAuthStore } from './useAuthStore';

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

type PersistenceScope = {
  employees?: boolean;
  roles?: boolean;
  weeks?: boolean;
  currentWeek?: boolean;
  extraWeekIds?: string[];
  areaSettings?: boolean;
};

type QueuedWeekEntry = {
  weekId: string;
  validationKey: string;
};

type AppState = PersistableState & {
  currentWeekStartDateISO: string;
  currentMonthStartDateISO: string;
  hydrated: boolean;
  syncError: string | null;
  flushPersistence: () => Promise<{ ok: boolean; error?: string }>;
  initialize: () => Promise<void>;
  refreshState: () => Promise<void>;
  setCurrentWeekStartDate: (startDateISO: string) => void;
  goToAdjacentWeek: (direction: -1 | 1) => void;
  goToAdjacentMonth: (direction: -1 | 1) => void;
  setCurrentArea: (areaId: AreaId) => void;
  resetAll: () => void;
  upsertEmployee: (employee: Employee) => { ok: boolean; error?: string };
  batchUpsertEmployees: (employees: Employee[]) => void;
  deleteEmployee: (employeeId: string) => void;
  deleteAllEmployees: () => void;
  deleteEmployeesByCompany: (companyId: string) => void;
  upsertRole: (role: Role) => { ok: boolean; error?: string };
  deleteRole: (roleId: string) => void;
  ensureWeekPlan: (week: Week) => void;
  updateAssignment: (input: UpdateAssignmentInput) => { ok: boolean; error?: string };
  updateEmployeeDayAssignments: (input: UpdateEmployeeDayAssignmentsInput) => { ok: boolean; error?: string };
  updateEmployeeDayByHours: (input: UpdateEmployeeDayByHoursInput) => { ok: boolean; error?: string };
  setExceptionalRestDay: (input: { weekId: string; dateISO: string; employeeId: string; active: boolean }) => { ok: boolean; error?: string };
  validateWeekPlan: (weekId: string, actorName?: string) => { ok: boolean; error?: string };
  desvalidateWeekPlan: (weekId: string) => { ok: boolean; error?: string };
  setPlanningHoursRange: (startHour: number, endHour: number) => { ok: boolean; error?: string };
  setShiftRanges: (input: ShiftRanges) => { ok: boolean; error?: string };
  setValidationRequirements: (input: ValidationRequirements) => { ok: boolean; error?: string };
  setBreakConfig: (input: BreakConfig) => { ok: boolean; error?: string };
  migrateFromPreviousWeek: () => { ok: boolean; error?: string };
};

const seeded = rebuildUnlockedWeekPlansForAllAreas(loadSeedState());
const CURRENT_AREA_STORAGE_KEY = 'app_horario2_current_area_id';

function getStoredCurrentAreaId(): AreaId | null {
  const value = localStorage.getItem(CURRENT_AREA_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
}

function setStoredCurrentAreaId(areaId: AreaId): void {
  localStorage.setItem(CURRENT_AREA_STORAGE_KEY, areaId);
}

function validRoleCodes(roles: Role[]): Set<string> {
  return new Set(roles.flatMap((role) => role.validCodes.map((code) => `${role.id}|${code}`)));
}

function toScopedWeekId(areaId: AreaId, weekId: string): string {
  return `${areaId}::${weekId}`;
}

function resolveScopedWeekId(currentAreaId: AreaId, weekId: string): string {
  if (weekId.includes('::')) return weekId;
  return toScopedWeekId(currentAreaId, weekId);
}

function areaFromWeekId(weekId: string): AreaId {
  if (!weekId.includes('::')) return 'salon';
  const [areaId] = weekId.split('::');
  return areaId && areaId.trim().length > 0 ? areaId : 'salon';
}

function baseWeekIdFromScopedWeekId(weekId: string): string {
  if (!weekId.includes('::')) return weekId;
  return weekId.split('::')[1] ?? weekId;
}

function getSelectedCompanyId(): string | null {
  return useAuthStore.getState().selectedGeoVictoriaCompanyId ?? null;
}

function rolesForArea(roles: Role[], areaId: AreaId): Role[] {
  return roles.filter((role) => (role.areaId ?? 'salon') === areaId);
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

function normalizeIdentityDocument(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, '').toLowerCase();
}

function employeeModuleCompanyId(employee: Pick<Employee, 'moduleCompanyId' | 'companyId'>): string {
  return employee.moduleCompanyId ?? employee.companyId ?? '';
}

function employeeAffectsPlanning(employee: Employee | undefined): boolean {
  if (!employee || !employee.active) return false;
  return Boolean(employee.mainRoleId && (employee.weeklyHours ?? 0) > 0);
}

function buildAutoWeekPlanForEmployee(
  plan: WeekPlan,
  employeeId: string,
  roleId: string,
  preferredRoleCode: string | undefined,
  weeklyHours: number,
  restDay: number,
  shiftType: Employee['shiftType'],
  shiftRanges: ShiftRanges,
  breakConfig: BreakConfig,
  timeSlots: TimeSlot[],
  roles: Role[]
): WeekPlan {
  const role = roles.find((item) => item.id === roleId);
  const code = (preferredRoleCode && role?.validCodes.includes(preferredRoleCode) ? preferredRoleCode : role?.validCodes[0])?.trim();
  if (!code) return clearEmployeeFromWeekPlan(plan, employeeId, timeSlots);

  const assignableSlots = getAssignableTimeSlots(timeSlots);
  const workableSlots = getWorkableTimeSlots(assignableSlots, breakConfig);
  const preferredPlanningSlots = getAutoPlanningTimeSlots(workableSlots, shiftType, shiftRanges);
  // Si el colaborador tiene turno (day/night), respetamos estrictamente ese rango aunque no alcance las horas semanales.
  // Solo usamos todos los bloques cuando no hay turno definido.
  const effectivePlanningSlots =
    shiftType && preferredPlanningSlots.length > 0 ? preferredPlanningSlots : workableSlots;
  const planningSlotIds = new Set(effectivePlanningSlots.map((slot) => slot.id));
  const slotHoursById = new Map(effectivePlanningSlots.map((slot) => [slot.id, getSlotDurationHours(slot.start, slot.end)]));
  let remainingHours = Math.max(0, weeklyHours);

  const days = plan.days.map((day) => {
    const assignments = { ...day.assignments };
    const isRestDay = parseISODateToDay(day.dateISO) === restDay;
    for (const slot of assignableSlots) {
      const byEmployee = { ...(assignments[slot.id] ?? {}) };
      const existing = byEmployee[employeeId];
      if (isBreakAssignment(existing)) {
        byEmployee[employeeId] = createBreakAssignment();
        assignments[slot.id] = byEmployee;
        continue;
      }
      const isPlanningSlot = planningSlotIds.has(slot.id);
      const slotHours = slotHoursById.get(slot.id) ?? 0;

      if (isPlanningSlot && !isRestDay && remainingHours > 0 && slotHours > 0) {
        byEmployee[employeeId] = { roleId, code };
        remainingHours = Number((remainingHours - slotHours).toFixed(4));
      } else {
        byEmployee[employeeId] = createFreeAssignment();
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
  shiftRanges: ShiftRanges,
  breakConfig: BreakConfig
): Record<string, WeekPlan> {
  const next: Record<string, WeekPlan> = {};

  for (const [weekId, weekPlan] of Object.entries(weekPlans)) {
    const areaId = areaFromWeekId(weekId);
    const scopedRoles = rolesForArea(roles, areaId);
    const roleIds = new Set(scopedRoles.map((role) => role.id));
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
        employee.mainRoleCode,
        weeklyHours,
        plan.restDayOverrides?.[employee.id] ?? normalizeRestDay(employee.restDay),
        employee.shiftType,
        shiftRanges,
        breakConfig,
        timeSlots,
        scopedRoles
      );
    }

    next[weekId] = plan;
  }

  return next;
}

function getAssignableTimeSlots(timeSlots: TimeSlot[] | undefined): TimeSlot[] {
  return [...(timeSlots ?? [])].sort((a, b) => a.order - b.order);
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
      byEmployee[employeeId] = createFreeAssignment();
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

function buildWeekConfigurationSnapshotForArea(state: PersistableState, areaId: AreaId): WeekConfigurationSnapshot {
  const areaTimeSlots = state.timeSlotsByArea[areaId] ?? state.timeSlots;
  const areaShiftRanges = state.shiftRangesByArea[areaId] ?? state.shiftRanges;
  const areaValidationRequirements = state.validationRequirementsByArea[areaId] ?? state.validationRequirements;
  const areaBreakConfig = state.breakConfigByArea[areaId] ?? state.breakConfig;

  return {
    areaId,
    timeSlots: areaTimeSlots.map((slot) => ({ ...slot })),
    shiftRanges: {
      day: { ...areaShiftRanges.day },
      night: { ...areaShiftRanges.night }
    },
    validationRequirements: {
      0: { ...areaValidationRequirements[0] },
      1: { ...areaValidationRequirements[1] },
      2: { ...areaValidationRequirements[2] },
      3: { ...areaValidationRequirements[3] },
      4: { ...areaValidationRequirements[4] },
      5: { ...areaValidationRequirements[5] },
      6: { ...areaValidationRequirements[6] }
    },
    breakConfig: { ...areaBreakConfig }
  };
}

function cloneWeekConfigurationSnapshot(snapshot: WeekConfigurationSnapshot): WeekConfigurationSnapshot {
  return {
    areaId: snapshot.areaId,
    timeSlots: snapshot.timeSlots.map((slot) => ({ ...slot })),
    shiftRanges: {
      day: { ...snapshot.shiftRanges.day },
      night: { ...snapshot.shiftRanges.night }
    },
    validationRequirements: {
      0: { ...snapshot.validationRequirements[0] },
      1: { ...snapshot.validationRequirements[1] },
      2: { ...snapshot.validationRequirements[2] },
      3: { ...snapshot.validationRequirements[3] },
      4: { ...snapshot.validationRequirements[4] },
      5: { ...snapshot.validationRequirements[5] },
      6: { ...snapshot.validationRequirements[6] }
    },
    breakConfig: { ...snapshot.breakConfig }
  };
}

function getWeekConfigurationSnapshot(state: PersistableState, scopedWeekId: string): WeekConfigurationSnapshot {
  const existing = state.weekConfigById[scopedWeekId];
  if (existing && existing.timeSlots.length > 0) {
    return cloneWeekConfigurationSnapshot(existing);
  }
  return buildWeekConfigurationSnapshotForArea(state, areaFromWeekId(scopedWeekId));
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

function buildDefaultBreakConfig(startHour: number, endHour: number): BreakConfig {
  const clampedStart = Math.min(startHour + 4, endHour - 1);
  const fallbackStart = Number.isInteger(clampedStart) ? clampedStart : Math.max(startHour, endHour - 1);
  const fallbackEnd = Math.min(fallbackStart + 1, endHour);
  return {
    enabled: false,
    startHour: fallbackStart,
    endHour: fallbackEnd
  };
}

function buildFallbackShiftRanges(): ShiftRanges {
  return {
    day: { startHour: 9, endHour: 17 },
    night: { startHour: 17, endHour: 23 }
  };
}

function buildFallbackBreakConfig(): BreakConfig {
  return {
    enabled: false,
    startHour: 13,
    endHour: 14
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

function normalizeBreakConfigToPlanningBounds(
  input: BreakConfig,
  planningStartHour: number,
  planningEndHour: number
): BreakConfig {
  const defaults = buildDefaultBreakConfig(planningStartHour, planningEndHour);
  const startHour = Number.isInteger(input.startHour) ? input.startHour : defaults.startHour;
  const endHour = Number.isInteger(input.endHour) ? input.endHour : defaults.endHour;
  const valid =
    startHour >= planningStartHour &&
    startHour < planningEndHour &&
    endHour > planningStartHour &&
    endHour <= planningEndHour &&
    endHour > startHour;
  return {
    enabled: Boolean(input.enabled),
    startHour: valid ? startHour : defaults.startHour,
    endHour: valid ? endHour : defaults.endHour
  };
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
            byEmployee[employeeId] = createFreeAssignment();
          }
          assignments[slot.id] = byEmployee;
        }

        return { ...day, assignments };
      })
    };
  }

  return next;
}

function remapWeekPlansToTimeSlotsForArea(
  weekPlans: Record<string, WeekPlan>,
  timeSlots: TimeSlot[],
  employeeIds: string[],
  areaId: AreaId,
  validatedWeekIds: string[],
  targetWeekIds?: Set<string>
): Record<string, WeekPlan> {
  const next = { ...weekPlans };
  for (const [weekId, plan] of Object.entries(weekPlans)) {
    if (areaFromWeekId(weekId) !== areaId) continue;
    if (validatedWeekIds.includes(weekId)) continue;
    if (targetWeekIds && !targetWeekIds.has(weekId)) continue;
    next[weekId] = remapWeekPlansToTimeSlots({ [weekId]: plan }, timeSlots, employeeIds)[weekId];
  }
  return next;
}

function rebuildWeekPlansForArea(
  weekPlans: Record<string, WeekPlan>,
  employees: Employee[],
  roles: Role[],
  areaId: AreaId,
  validatedWeekIds: string[],
  weekConfigById: PersistableState['weekConfigById'],
  timeSlotsByArea: PersistableState['timeSlotsByArea'],
  shiftRangesByArea: PersistableState['shiftRangesByArea'],
  breakConfigByArea: PersistableState['breakConfigByArea'],
  targetWeekIds?: Set<string>
): Record<string, WeekPlan> {
  const next = { ...weekPlans };
  for (const [weekId, plan] of Object.entries(weekPlans)) {
    if (areaFromWeekId(weekId) !== areaId) continue;
    if (validatedWeekIds.includes(weekId)) continue;
    if (targetWeekIds && !targetWeekIds.has(weekId)) continue;
    const weekConfig = weekConfigById[weekId];
    const timeSlots =
      weekConfig?.timeSlots?.length
        ? weekConfig.timeSlots
        : timeSlotsByArea[areaId] ?? [];
    const shiftRanges = weekConfig?.shiftRanges ?? shiftRangesByArea[areaId] ?? buildFallbackShiftRanges();
    const breakConfig = weekConfig?.breakConfig ?? breakConfigByArea[areaId] ?? buildFallbackBreakConfig();
    const rebuilt = rebuildWeekPlansFromEmployees({ [weekId]: plan }, employees, roles, timeSlots, shiftRanges, breakConfig);
    next[weekId] = rebuilt[weekId];
  }
  return next;
}

function sortWeeksByStartDate(weeks: Week[]): Week[] {
  return [...weeks].sort((a, b) => a.startDateISO.localeCompare(b.startDateISO));
}

function mergeWeeks(preferred: Week[], fallback: Week[]): Week[] {
  const byStartDate = new Map<string, Week>();
  for (const week of fallback) {
    byStartDate.set(week.startDateISO, week);
  }
  for (const week of preferred) {
    byStartDate.set(week.startDateISO, week);
  }
  return sortWeeksByStartDate(Array.from(byStartDate.values()));
}

function monthStartDateISO(date: Date): string {
  return formatISO(new Date(date.getFullYear(), date.getMonth(), 1), { representation: 'date' });
}


function ensureWeekExists(weeks: Week[], startDateISO: string): { weeks: Week[]; week: Week; created: boolean } {
  const existing = weeks.find((week) => week.startDateISO === startDateISO);
  if (existing) {
    return { weeks: sortWeeksByStartDate(weeks), week: existing, created: false };
  }
  const week = buildWeekFromStartDate(parseISO(startDateISO));
  return {
    weeks: sortWeeksByStartDate([...weeks, week]),
    week,
    created: true
  };
}

function isWeekUnlockedForPlanning(weeks: Week[], validatedWeekIds: string[], scopedWeekId: string): boolean {
  const baseWeekId = baseWeekIdFromScopedWeekId(scopedWeekId);
  const week = weeks.find((item) => item.id === baseWeekId);
  if (!week) return true;

  const currentWeekStartDateISO = getCurrentWeekStartDateISO();
  if (week.startDateISO <= currentWeekStartDateISO) {
    return true;
  }

  const orderedWeeks = sortWeeksByStartDate(weeks);
  const currentIndex = orderedWeeks.findIndex((item) => item.id === baseWeekId);
  if (currentIndex <= 0) {
    return true;
  }

  const previousWeek = orderedWeeks[currentIndex - 1];
  const previousScopedWeekId = toScopedWeekId(areaFromWeekId(scopedWeekId), previousWeek.id);
  return validatedWeekIds.includes(previousScopedWeekId);
}

function getSelectedScopedWeekId(state: Pick<PersistableState, 'weeks' | 'currentAreaId'> & { currentWeekStartDateISO: string }): string | null {
  if (!state.currentAreaId) return null;
  const currentWeek = state.weeks.find((week) => week.startDateISO === state.currentWeekStartDateISO);
  if (!currentWeek) return null;
  return toScopedWeekId(state.currentAreaId, currentWeek.id);
}

function getSelectedScopedWeekIdForArea(
  state: Pick<PersistableState, 'weeks'> & { currentWeekStartDateISO: string },
  areaId: AreaId
): string | null {
  if (!areaId) return null;
  const currentWeek = state.weeks.find((week) => week.startDateISO === state.currentWeekStartDateISO);
  if (!currentWeek) return null;
  return toScopedWeekId(areaId, currentWeek.id);
}

function getConfigurationTargetWeekIds(state: PersistableState & { currentWeekStartDateISO: string }, areaId: AreaId): Set<string> {
  if (!areaId) return new Set<string>();
  const scopedWeekId = getSelectedScopedWeekId({ ...state, currentAreaId: areaId });
  if (!scopedWeekId) return new Set<string>();
  if (state.validatedWeekIds.includes(scopedWeekId)) return new Set<string>();
  if (!isWeekUnlockedForPlanning(state.weeks, state.validatedWeekIds, scopedWeekId)) return new Set<string>();
  return new Set([scopedWeekId]);
}

function getAreaCodes(state: PersistableState): string[] {
  const fromAreas = state.areas?.map((a) => a.code) ?? [];
  const fromMaps = Object.keys(state.timeSlotsByArea);
  const combined = new Set([...fromAreas, ...fromMaps]);
  if (state.currentAreaId) combined.add(state.currentAreaId);
  return Array.from(combined);
}

function rebuildUnlockedWeekPlansForAllAreas(state: PersistableState): PersistableState {
  let weekPlans = state.weekPlans;
  for (const areaId of getAreaCodes(state)) {
    weekPlans = rebuildWeekPlansForArea(
      weekPlans,
      state.employees,
      state.roles,
      areaId,
      state.validatedWeekIds,
      state.weekConfigById,
      state.timeSlotsByArea,
      state.shiftRangesByArea,
      state.breakConfigByArea
    );
  }

  return {
    ...state,
    weekPlans
  };
}

function toPersistableState(state: AppState): PersistableState {
  return {
    areas: state.areas,
    employees: state.employees,
    roles: state.roles,
    currentAreaId: state.currentAreaId,
    timeSlots: state.timeSlots,
    shiftRanges: state.shiftRanges,
    validationRequirements: state.validationRequirements,
    breakConfig: state.breakConfig,
    timeSlotsByArea: state.timeSlotsByArea,
    shiftRangesByArea: state.shiftRangesByArea,
    validationRequirementsByArea: state.validationRequirementsByArea,
    breakConfigByArea: state.breakConfigByArea,
    weeks: state.weeks,
    weekPlans: state.weekPlans,
    validatedWeekIds: state.validatedWeekIds,
    weekAuditById: state.weekAuditById,
    weekConfigById: state.weekConfigById
  };
}

let persistInFlight = false;
let persistWaiters: Array<() => void> = [];
let pendingPersistence: Omit<Required<PersistenceScope>, 'extraWeekIds'> & { weekEntries: QueuedWeekEntry[] } = {
  employees: false,
  roles: false,
  weeks: false,
  currentWeek: false,
  areaSettings: false,
  weekEntries: []
};

function hasPendingPersistence(): boolean {
  return (
    pendingPersistence.employees ||
    pendingPersistence.roles ||
    pendingPersistence.weeks ||
    pendingPersistence.areaSettings ||
    pendingPersistence.weekEntries.length > 0
  );
}

function queuePersistenceScope(get: () => AppState, scope: PersistenceScope): void {
  if (scope.employees) pendingPersistence.employees = true;
  if (scope.roles) pendingPersistence.roles = true;
  if (scope.weeks) pendingPersistence.weeks = true;
  if (scope.areaSettings) pendingPersistence.areaSettings = true;
  if (scope.currentWeek) {
    const scopedWeekId = getSelectedScopedWeekId(get());
    if (scopedWeekId) {
      pendingPersistence.currentWeek = true;
      pendingPersistence.weekEntries.push({
        weekId: scopedWeekId,
        validationKey: scopedWeekId
      });
    }
  }
  if (scope.extraWeekIds) {
    for (const weekId of scope.extraWeekIds) {
      pendingPersistence.weekEntries.push({
        weekId,
        validationKey: weekId
      });
    }
  }
}

function filterWeeksForPersistence(state: AppState): Week[] {
  const currentWeekISO = getCurrentWeekStartDateISO();
  const nextWeekISO = formatISO(addWeeks(parseISO(currentWeekISO), 1), { representation: 'date' });
  const validatedBaseWeekIds = new Set(state.validatedWeekIds.map((id) => baseWeekIdFromScopedWeekId(id)));
  return state.weeks.filter(
    (week) => week.startDateISO <= currentWeekISO || validatedBaseWeekIds.has(week.id) || week.startDateISO === nextWeekISO
  );
}

async function flushPersistQueue(get: () => AppState, set: (partial: Partial<AppState>) => void): Promise<void> {
  if (persistInFlight) {
    await new Promise<void>((resolve) => {
      persistWaiters.push(resolve);
    });
    return;
  }
  persistInFlight = true;
  try {
    while (hasPendingPersistence()) {
      const stateSnapshot = get();
      const queuedWeekEntries = [...pendingPersistence.weekEntries];
      const scope = {
        employees: pendingPersistence.employees,
        roles: pendingPersistence.roles,
        weeks: pendingPersistence.weeks,
        currentWeek: pendingPersistence.currentWeek,
        areaSettings: pendingPersistence.areaSettings
      };
      pendingPersistence = {
        employees: false,
        roles: false,
        weeks: false,
        currentWeek: false,
        areaSettings: false,
        weekEntries: []
      } as Omit<Required<PersistenceScope>, 'extraWeekIds'> & { weekEntries: QueuedWeekEntry[] };

      const payload = {
        ...(scope.employees ? { employees: stateSnapshot.employees } : {}),
        ...(scope.roles ? { roles: stateSnapshot.roles } : {}),
        ...(scope.weeks ? { weeks: filterWeeksForPersistence(stateSnapshot) } : {}),
        ...(queuedWeekEntries.length > 0
          ? {
              weekEntries: queuedWeekEntries
                .filter((entry, index, array) => array.findIndex((item) => item.weekId === entry.weekId && item.validationKey === entry.validationKey) === index)
                .filter((weekId) => {
                  const baseId = baseWeekIdFromScopedWeekId(weekId.weekId);
                  // No persistir planes de semanas futuras no validadas (excepto la siguiente inmediata, ya inicializada)
                  const week = stateSnapshot.weeks.find((w) => w.id === baseId);
                  if (!week) return false;
                  const currentWeekISO = getCurrentWeekStartDateISO();
                  const nextWeekISO = formatISO(addWeeks(parseISO(currentWeekISO), 1), { representation: 'date' });
                  if (week.startDateISO > nextWeekISO) return false; // descartar semanas demasiado futuras
                  return true;
                })
                .flatMap((entry) => {
                  const validationKey = entry.validationKey;
                  return [
                    {
                      weekId: entry.weekId,
                      weekPlan: stateSnapshot.weekPlans[entry.weekId],
                      weekConfig: stateSnapshot.weekConfigById[entry.weekId]
                    },
                    {
                      weekId: validationKey,
                      weekAudit: stateSnapshot.weekAuditById[validationKey],
                      validated: stateSnapshot.validatedWeekIds.includes(validationKey)
                    }
                  ];
                })
            }
          : {}),
        ...(scope.areaSettings
          ? {
              areaSettings: getAreaCodes(stateSnapshot).map((areaId) => ({
                areaId,
                timeSlots: stateSnapshot.timeSlotsByArea[areaId],
                shiftRanges: stateSnapshot.shiftRangesByArea[areaId],
                validationRequirements: stateSnapshot.validationRequirementsByArea[areaId],
                breakConfig: stateSnapshot.breakConfigByArea[areaId]
              }))
            }
          : {})
      };

      try {
        await savePlannerStatePartial(payload, getSelectedCompanyId());
        set({ syncError: null });
      } catch (error) {
        set({ syncError: error instanceof Error ? error.message : 'No se pudo sincronizar con el backend.' });
      }
    }
  } finally {
    persistInFlight = false;
    const waiters = [...persistWaiters];
    persistWaiters = [];
    waiters.forEach((resolve) => resolve());
  }
}

function persistSnapshot(get: () => AppState, set: (partial: Partial<AppState>) => void, scope: PersistenceScope): void {
  queuePersistenceScope(get, scope);
  void flushPersistQueue(get, set);
}

export const useAppStore = create<AppState>((set, get) => ({
  ...seeded,
  currentWeekStartDateISO: seeded.weeks[0]?.startDateISO ?? '',
  currentMonthStartDateISO: monthStartDateISO(parseISO(seeded.weeks[0]?.startDateISO ?? formatISO(new Date(), { representation: 'date' }))),
  currentAreaId: getStoredCurrentAreaId() ?? seeded.currentAreaId,
  hydrated: false,
  syncError: null,

  flushPersistence: async () => {
    if (hasPendingPersistence() || persistInFlight) {
      await flushPersistQueue(get, set);
    }

    const error = get().syncError;
    if (error) {
      return { ok: false, error };
    }

    return { ok: true };
  },

  initialize: async () => {
    if (get().hydrated) return;

    const companyId = getSelectedCompanyId();
    if (!companyId) {
      set({ hydrated: true, syncError: null });
      return;
    }

    try {
      const remote = await fetchPlannerState(companyId);
      const normalized = normalizePlannerState(remote);
      const todayWeekISO = getCurrentWeekStartDateISO();
      // Ensure today's week exists in the weeks array
      const { weeks: weeksWithToday, week: todayWeek } = ensureWeekExists(normalized.weeks, todayWeekISO);
      // Ensure today's week has a plan for all areas
      const weekPlans = { ...normalized.weekPlans };
      const weekAuditById = { ...normalized.weekAuditById };
      const weekConfigById = { ...normalized.weekConfigById };
      for (const areaId of getAreaCodes(normalized)) {
        const scopedId = toScopedWeekId(areaId, todayWeek.id);
        if (!weekPlans[scopedId]) {
          const areaTimeSlots = normalized.timeSlotsByArea[areaId] ?? normalized.timeSlots;
          const timeSlotIds = areaTimeSlots.map((s) => s.id);
          weekPlans[scopedId] = buildEmptyWeekPlan(
            todayWeek,
            normalized.employees.map((e) => e.id),
            timeSlotIds
          );
          weekAuditById[scopedId] = { createdByName: null, validatedByName: null };
          // Ensure weekConfigById matches the slot IDs used to build the plan
          if (!weekConfigById[scopedId]) {
            weekConfigById[scopedId] = buildWeekConfigurationSnapshotForArea(normalized, areaId);
          }
        }
      }
      const storedAreaId = getStoredCurrentAreaId();
      const areaCodes = getAreaCodes(normalized);
      const candidateAreaId = storedAreaId && areaCodes.includes(storedAreaId)
        ? storedAreaId
        : areaCodes[0] ?? normalized.currentAreaId;
      // If the candidate area has no roles, prefer the first area that has roles.
      const candidateHasRoles = normalized.roles.some((r) => (r.areaId ?? 'salon') === candidateAreaId);
      const resolvedAreaId = candidateHasRoles
        ? candidateAreaId
        : (areaCodes.find((code) => normalized.roles.some((r) => (r.areaId ?? 'salon') === code)) ?? candidateAreaId);
      set({
        ...normalized,
        weeks: weeksWithToday,
        weekPlans,
        weekAuditById,
        weekConfigById,
        currentAreaId: resolvedAreaId,
        timeSlots: normalized.timeSlotsByArea[resolvedAreaId] ?? normalized.timeSlots,
        shiftRanges: normalized.shiftRangesByArea[resolvedAreaId] ?? normalized.shiftRanges,
        validationRequirements: normalized.validationRequirementsByArea[resolvedAreaId] ?? normalized.validationRequirements,
        breakConfig: normalized.breakConfigByArea[resolvedAreaId] ?? normalized.breakConfig,
        currentWeekStartDateISO: todayWeekISO,
        currentMonthStartDateISO: monthStartDateISO(parseISO(todayWeekISO)),
        hydrated: true,
        syncError: null
      });
    } catch (error) {
      set({
        currentAreaId: getStoredCurrentAreaId() ?? seeded.currentAreaId,
        hydrated: true,
        syncError: error instanceof Error ? error.message : 'No se pudo cargar el backend. Se usa estado local temporal.'
      });
    }
  },

  refreshState: async () => {
    set({ hydrated: false });
    await get().initialize();
  },

  setCurrentWeekStartDate: (startDateISO) => {
    let changed = false;
    set((state) => {
      const result = ensureWeekExists(state.weeks, startDateISO);
      changed = result.created || state.currentWeekStartDateISO !== result.week.startDateISO;
      const nextState: Partial<AppState> = {
        weeks: result.weeks,
        currentWeekStartDateISO: result.week.startDateISO
      };
      if (result.created) {
        if (!state.currentAreaId) {
          return nextState;
        }
        const scopedWeekId = resolveScopedWeekId(state.currentAreaId, result.week.id);
        nextState.weekPlans = {
          ...state.weekPlans,
          [scopedWeekId]: buildEmptyWeekPlan(
            result.week,
            state.employees.map((employee) => employee.id),
            (state.timeSlotsByArea[state.currentAreaId] ?? state.timeSlots).map((slot) => slot.id)
          )
        };
        nextState.weekAuditById = {
          ...state.weekAuditById,
          [scopedWeekId]: { createdByName: null, validatedByName: null }
        };
      }
      return nextState;
    });
    if (changed) {
      persistSnapshot(get, set, { weeks: true, currentWeek: true });
    }
  },
  goToAdjacentWeek: (direction) => {
    const current = get().currentWeekStartDateISO || get().weeks[0]?.startDateISO;
    if (!current) return;
    const nextStartDateISO = formatISO(addWeeks(parseISO(current), direction), { representation: 'date' });
    get().setCurrentWeekStartDate(nextStartDateISO);
    set({
      currentMonthStartDateISO: monthStartDateISO(parseISO(nextStartDateISO))
    });
  },
  goToAdjacentMonth: (direction) =>
    set((state) => ({
      currentMonthStartDateISO: monthStartDateISO(addMonths(parseISO(state.currentMonthStartDateISO), direction))
    })),
  setCurrentArea: (areaId) => {
    const prev = get();
    const prevAreaId = prev.currentAreaId;
    // Persist the outgoing area's current week plan before switching so data is not lost.
    if (prevAreaId !== areaId) {
      const outgoingScopedWeekId = getSelectedScopedWeekId(prev);
      if (outgoingScopedWeekId && prev.weekPlans[outgoingScopedWeekId]) {
        persistSnapshot(get, set, { currentWeek: true });
      }
    }
    set((state) => {
      setStoredCurrentAreaId(areaId);
      // Preserve the outgoing area's global settings back into the ByArea maps to prevent data
      // divergence when the global timeSlots/shiftRanges were updated independently.
      const timeSlotsByArea = prevAreaId !== areaId
        ? { ...state.timeSlotsByArea, [prevAreaId]: state.timeSlotsByArea[prevAreaId] ?? state.timeSlots }
        : state.timeSlotsByArea;
      const shiftRangesByArea = prevAreaId !== areaId
        ? { ...state.shiftRangesByArea, [prevAreaId]: state.shiftRangesByArea[prevAreaId] ?? state.shiftRanges }
        : state.shiftRangesByArea;
      const breakConfigByArea = prevAreaId !== areaId
        ? { ...state.breakConfigByArea, [prevAreaId]: state.breakConfigByArea[prevAreaId] ?? state.breakConfig }
        : state.breakConfigByArea;

      // Ensure the incoming area's current week plan exists so the UI never flashes empty.
      const currentWeek = state.weeks.find((week) => week.startDateISO === state.currentWeekStartDateISO);
      let weekPlans = state.weekPlans;
      let weekAuditById = state.weekAuditById;
      let weekConfigById = state.weekConfigById;
      const incomingState = { ...state, timeSlotsByArea, shiftRangesByArea, breakConfigByArea, currentAreaId: areaId };
      if (currentWeek) {
        const incomingScopedWeekId = toScopedWeekId(areaId, currentWeek.id);
        if (!weekPlans[incomingScopedWeekId]) {
          const weekConfig = getWeekConfigurationSnapshot(incomingState, incomingScopedWeekId);
          const emptyWeekPlan = buildEmptyWeekPlan(
            currentWeek,
            state.employees.map((employee) => employee.id),
            weekConfig.timeSlots.map((slot) => slot.id)
          );
          weekPlans = {
            ...weekPlans,
            [incomingScopedWeekId]: rebuildWeekPlansFromEmployees(
              { [incomingScopedWeekId]: emptyWeekPlan },
              state.employees,
              state.roles,
              weekConfig.timeSlots,
              weekConfig.shiftRanges,
              weekConfig.breakConfig
            )[incomingScopedWeekId]
          };
          weekAuditById = {
            ...weekAuditById,
            [incomingScopedWeekId]: weekAuditById[incomingScopedWeekId] ?? { createdByName: null, validatedByName: null }
          };
          if (!weekConfigById[incomingScopedWeekId]) {
            weekConfigById = { ...weekConfigById, [incomingScopedWeekId]: weekConfig };
          }
        } else {
          // Plan exists — reconcile weekConfigById so render slot IDs match plan slot IDs.
          const plan = weekPlans[incomingScopedWeekId];
          const existingConfig = weekConfigById[incomingScopedWeekId];
          if (existingConfig && plan.days[0]) {
            const planSlotIds = new Set(Object.keys(plan.days[0].assignments));
            const configSlotIds = new Set(existingConfig.timeSlots.map((s) => s.id));
            const mismatch = planSlotIds.size > 0 && ![...planSlotIds].every((id) => configSlotIds.has(id));
            if (mismatch) {
              // weekConfigById has stale slot IDs — replace with current area config
              weekConfigById = {
                ...weekConfigById,
                [incomingScopedWeekId]: buildWeekConfigurationSnapshotForArea(incomingState, areaId)
              };
            }
          }
        }
      }

      return {
        currentAreaId: areaId,
        timeSlots: timeSlotsByArea[areaId] ?? state.timeSlots,
        shiftRanges: shiftRangesByArea[areaId] ?? state.shiftRanges,
        validationRequirements: state.validationRequirementsByArea[areaId] ?? state.validationRequirements,
        breakConfig: breakConfigByArea[areaId] ?? state.breakConfig,
        timeSlotsByArea,
        shiftRangesByArea,
        breakConfigByArea,
        weekPlans,
        weekAuditById,
        weekConfigById
      };
    });
  },

  resetAll: () => {
    const todayWeekISO = getCurrentWeekStartDateISO();
    set({
      ...seeded,
      currentWeekStartDateISO: todayWeekISO,
      currentMonthStartDateISO: monthStartDateISO(parseISO(todayWeekISO))
    });
    void resetPlannerStateApi(getSelectedCompanyId())
      .then((fresh) => {
        const normalized = normalizePlannerState(fresh);
        set({
          ...normalized,
          currentWeekStartDateISO: todayWeekISO,
          currentMonthStartDateISO: monthStartDateISO(parseISO(todayWeekISO)),
          syncError: null
        });
      })
      .catch((error) => {
        set({ syncError: error instanceof Error ? error.message : 'No se pudo resetear en backend.' });
      });
  },

  upsertEmployee: (employee) => {
    let result: { ok: boolean; error?: string } = { ok: true };
    let shouldPersistCurrentWeek = false;
    let persistWeekIds: string[] = [];
    set((state) => {
      const previous = state.employees.find((item) => item.id === employee.id);
      const incomingDocument = normalizeIdentityDocument(employee.identityDocument);
      const previousDocument = normalizeIdentityDocument(previous?.identityDocument);
      const incomingEmail = (employee.email ?? '').trim().toLowerCase();
      const previousEmail = (previous?.email ?? '').trim().toLowerCase();
      const incomingModuleCompanyId = employeeModuleCompanyId(employee);
      const shouldValidateIdentityDocument = !previous || incomingDocument !== previousDocument;
      const shouldValidateEmail = Boolean(incomingEmail) && (!previous || incomingEmail !== previousEmail);
      if (shouldValidateIdentityDocument && incomingDocument) {
        const duplicated = state.employees.some(
          (item) =>
            item.id !== employee.id &&
            employeeModuleCompanyId(item) === incomingModuleCompanyId &&
            normalizeIdentityDocument(item.identityDocument) === incomingDocument
        );
        if (duplicated) {
          result = { ok: false, error: 'Ya existe un colaborador con el mismo Documento de Identidad (DNI).' };
          return {};
        }
      }
      if (shouldValidateEmail) {
        const duplicatedEmail = state.employees.some(
          (item) => item.id !== employee.id && (item.email ?? '').trim().toLowerCase() === incomingEmail
        );
        if (duplicatedEmail) {
          result = { ok: false, error: 'Ya existe un colaborador con el mismo correo electrónico.' };
          return {};
        }
      }
      const selectedRole = state.roles.find((role) => role.id === employee.mainRoleId);
      const normalizedAreaId = (selectedRole?.areaId ?? employee.areaId ?? previous?.areaId) as AreaId | undefined;
      const normalizedEmployee: Employee = {
        ...employee,
        areaId: normalizedAreaId,
        restDay: normalizeRestDay(employee.restDay),
        code: employee.code ?? previous?.code ?? getNextEmployeeCode(state.employees),
        mainRoleCode:
          employee.mainRoleCode ??
          previous?.mainRoleCode ??
          state.roles.find((role) => role.id === employee.mainRoleId)?.validCodes[0]
      };
      const exists = Boolean(previous);
      const employees = exists
        ? state.employees.map((item) => (item.id === normalizedEmployee.id ? normalizedEmployee : item))
        : [...state.employees, normalizedEmployee];

      const planningChanged =
        employeeAffectsPlanning(previous) !== employeeAffectsPlanning(normalizedEmployee) ||
        previous?.mainRoleId !== normalizedEmployee.mainRoleId ||
        previous?.mainRoleCode !== normalizedEmployee.mainRoleCode ||
        previous?.weeklyHours !== normalizedEmployee.weeklyHours ||
        previous?.restDay !== normalizedEmployee.restDay ||
        previous?.contractType !== normalizedEmployee.contractType ||
        previous?.shiftType !== normalizedEmployee.shiftType ||
        previous?.active !== normalizedEmployee.active;

      if (!planningChanged) {
        return { employees };
      }

      const employeeAreaId = normalizedEmployee.areaId ?? previous?.areaId;
      if (!employeeAreaId) {
        return { employees };
      }
      const selectedScopedWeekId = getSelectedScopedWeekIdForArea(state, employeeAreaId);
      if (!selectedScopedWeekId) {
        return { employees };
      }
      shouldPersistCurrentWeek = true;
      persistWeekIds = [selectedScopedWeekId];
      let weekPlans = state.weekPlans;
      let weekAuditById = state.weekAuditById;
      if (!weekPlans[selectedScopedWeekId]) {
        const currentWeek = state.weeks.find((week) => week.id === baseWeekIdFromScopedWeekId(selectedScopedWeekId));
        if (currentWeek) {
          const weekConfig = getWeekConfigurationSnapshot(state, selectedScopedWeekId);
          weekPlans = {
            ...weekPlans,
            [selectedScopedWeekId]: buildEmptyWeekPlan(
              currentWeek,
              employees.map((item) => item.id),
              weekConfig.timeSlots.map((slot) => slot.id)
            )
          };
          weekAuditById = {
            ...weekAuditById,
            [selectedScopedWeekId]: weekAuditById[selectedScopedWeekId] ?? { createdByName: null, validatedByName: null }
          };
        }
      }
      weekPlans = rebuildWeekPlansForArea(
        weekPlans,
        employees,
        state.roles,
        employeeAreaId,
        state.validatedWeekIds,
        state.weekConfigById,
        state.timeSlotsByArea,
        state.shiftRangesByArea,
        state.breakConfigByArea,
        new Set([selectedScopedWeekId])
      );

      return {
        employees,
        weekPlans,
        validatedWeekIds: state.validatedWeekIds,
        weekAuditById
      };
    });
    if (!result.ok) return result;
    persistSnapshot(get, set, { employees: true, currentWeek: shouldPersistCurrentWeek, extraWeekIds: persistWeekIds });
    return result;
  },

  batchUpsertEmployees: (incomingList) => {
    let shouldPersistCurrentWeek = false;
    let persistWeekIds: string[] = [];
    set((state) => {
      let employees = [...state.employees];
      const planningChangedAreas = new Set<AreaId>();

      for (const employee of incomingList) {
        const previous = employees.find((item) => item.id === employee.id);
        const incomingDocument = normalizeIdentityDocument(employee.identityDocument);
        const previousDocument = normalizeIdentityDocument(previous?.identityDocument);
        const incomingModuleCompanyId = employeeModuleCompanyId(employee);
        const shouldValidateIdentityDocument = !previous || incomingDocument !== previousDocument;
        if (shouldValidateIdentityDocument && incomingDocument) {
          const duplicated = employees.some(
            (item) =>
              item.id !== employee.id &&
              employeeModuleCompanyId(item) === incomingModuleCompanyId &&
              normalizeIdentityDocument(item.identityDocument) === incomingDocument
          );
          if (duplicated) continue;
        }
        const selectedRole = state.roles.find((role) => role.id === employee.mainRoleId);
        const normalizedAreaId = (selectedRole?.areaId ?? employee.areaId ?? previous?.areaId) as AreaId | undefined;
        const normalizedEmployee: Employee = {
          ...employee,
          areaId: normalizedAreaId,
          restDay: normalizeRestDay(employee.restDay),
          code: employee.code ?? previous?.code ?? getNextEmployeeCode(employees),
          mainRoleCode:
            employee.mainRoleCode ??
            previous?.mainRoleCode ??
            state.roles.find((role) => role.id === employee.mainRoleId)?.validCodes[0]
        };
        const exists = Boolean(previous);
        employees = exists
          ? employees.map((item) => (item.id === normalizedEmployee.id ? normalizedEmployee : item))
          : [...employees, normalizedEmployee];

        const planningChanged =
          employeeAffectsPlanning(previous) !== employeeAffectsPlanning(normalizedEmployee) ||
          previous?.mainRoleId !== normalizedEmployee.mainRoleId ||
          previous?.mainRoleCode !== normalizedEmployee.mainRoleCode ||
          previous?.weeklyHours !== normalizedEmployee.weeklyHours ||
          previous?.restDay !== normalizedEmployee.restDay ||
          previous?.contractType !== normalizedEmployee.contractType ||
          previous?.shiftType !== normalizedEmployee.shiftType ||
          previous?.active !== normalizedEmployee.active;

        if (planningChanged) {
          const areaId = normalizedEmployee.areaId ?? previous?.areaId;
          if (!areaId) continue;
          planningChangedAreas.add(areaId);
        }
      }

      if (planningChangedAreas.size === 0) {
        return { employees };
      }

      let weekPlans = state.weekPlans;
      let weekAuditById = state.weekAuditById;
      for (const areaId of planningChangedAreas) {
        const selectedScopedWeekId = getSelectedScopedWeekIdForArea(state, areaId);
        if (!selectedScopedWeekId) continue;
        shouldPersistCurrentWeek = true;
        persistWeekIds.push(selectedScopedWeekId);
        if (!weekPlans[selectedScopedWeekId]) {
          const currentWeek = state.weeks.find((week) => week.id === baseWeekIdFromScopedWeekId(selectedScopedWeekId));
          if (currentWeek) {
            const weekConfig = getWeekConfigurationSnapshot(state, selectedScopedWeekId);
            weekPlans = {
              ...weekPlans,
              [selectedScopedWeekId]: buildEmptyWeekPlan(
                currentWeek,
                employees.map((item) => item.id),
                weekConfig.timeSlots.map((slot) => slot.id)
              )
            };
            weekAuditById = {
              ...weekAuditById,
              [selectedScopedWeekId]: weekAuditById[selectedScopedWeekId] ?? { createdByName: null, validatedByName: null }
            };
          }
        }
        weekPlans = rebuildWeekPlansForArea(
          weekPlans,
          employees,
          state.roles,
          areaId,
          state.validatedWeekIds,
          state.weekConfigById,
          state.timeSlotsByArea,
          state.shiftRangesByArea,
          state.breakConfigByArea,
          new Set([selectedScopedWeekId])
        );
      }

      return {
        employees,
        weekPlans,
        validatedWeekIds: state.validatedWeekIds,
        weekAuditById
      };
    });
    persistSnapshot(get, set, { employees: true, currentWeek: shouldPersistCurrentWeek, extraWeekIds: persistWeekIds });
  },

  deleteEmployee: (employeeId) => {
    set((state) => {
      const employees = state.employees.filter((employee) => employee.id !== employeeId);
      const scopedWeekId = getSelectedScopedWeekId(state);
      if (!scopedWeekId || !state.weekPlans[scopedWeekId]) {
        return { employees };
      }
      const plan = state.weekPlans[scopedWeekId];
      const weekPlans: Record<string, WeekPlan> = {
        ...state.weekPlans,
        [scopedWeekId]: {
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
        }
      };

      return {
        employees,
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, scopedWeekId),
        weekAuditById: clearWeekValidator(state.weekAuditById, scopedWeekId)
      };
    });
    persistSnapshot(get, set, { employees: true, currentWeek: true });
  },

  deleteAllEmployees: () => {
    set((state) => {
      const scopedWeekId = getSelectedScopedWeekId(state);
      if (!scopedWeekId || !state.weekPlans[scopedWeekId]) {
        return { employees: [] };
      }
      const plan = state.weekPlans[scopedWeekId];
      const weekPlans: Record<string, WeekPlan> = {
        ...state.weekPlans,
        [scopedWeekId]: {
          ...plan,
          days: plan.days.map((day) => {
            const assignments: typeof day.assignments = {};
            for (const [slotId] of Object.entries(day.assignments)) {
              assignments[slotId] = {};
            }
            return { ...day, assignments };
          })
        }
      };

      return {
        employees: [],
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, scopedWeekId),
        weekAuditById: clearWeekValidator(state.weekAuditById, scopedWeekId)
      };
    });
    persistSnapshot(get, set, { employees: true, currentWeek: true });
  },

  deleteEmployeesByCompany: (companyId) => {
    set((state) => {
      const idsToDelete = new Set(
        state.employees
          .filter((employee) => (employee.moduleCompanyId ?? employee.companyId ?? '') === companyId)
          .map((employee) => employee.id)
      );
      if (idsToDelete.size === 0) {
        return {};
      }

      const employees = state.employees.filter((employee) => !idsToDelete.has(employee.id));
      const scopedWeekId = getSelectedScopedWeekId(state);
      if (!scopedWeekId || !state.weekPlans[scopedWeekId]) {
        return { employees };
      }
      const plan = state.weekPlans[scopedWeekId];
      const weekPlans: Record<string, WeekPlan> = {
        ...state.weekPlans,
        [scopedWeekId]: {
          ...plan,
          days: plan.days.map((day) => {
            const assignments = { ...day.assignments };
            for (const [slotId, byEmployee] of Object.entries(assignments)) {
              const nextByEmployee = { ...byEmployee };
              for (const employeeId of idsToDelete) {
                delete nextByEmployee[employeeId];
              }
              assignments[slotId] = nextByEmployee;
            }
            return { ...day, assignments };
          })
        }
      };

      return {
        employees,
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, scopedWeekId),
        weekAuditById: clearWeekValidator(state.weekAuditById, scopedWeekId)
      };
    });
    persistSnapshot(get, set, { employees: true, currentWeek: true });
  },

  upsertRole: (role) => {
    const { currentAreaId } = get();
    const normalizedRole: Role = {
      ...role,
      areaId: role.areaId ?? currentAreaId
    };
    set((state) => {
      const exists = state.roles.some((item) => item.id === role.id);
      const next = exists
        ? state.roles.map((item) => (item.id === role.id ? normalizedRole : item))
        : [...state.roles, normalizedRole];
      return { roles: next };
    });
    persistSnapshot(get, set, { roles: true });
    return { ok: true };
  },

  deleteRole: (roleId) => {
    set((state) => {
      const roles = state.roles.filter((role) => role.id !== roleId);
      const scopedWeekId = getSelectedScopedWeekId(state);
      if (!scopedWeekId || !state.weekPlans[scopedWeekId]) {
        return { roles };
      }
      const plan = state.weekPlans[scopedWeekId];
      const weekPlans = {
        ...state.weekPlans,
        [scopedWeekId]: {
          ...plan,
          days: plan.days.map((day) => {
            const assignments = { ...day.assignments };
            for (const [slotId, byEmployee] of Object.entries(assignments)) {
              assignments[slotId] = { ...byEmployee };
              for (const [employeeId, assignment] of Object.entries(assignments[slotId])) {
                if (assignment.roleId === roleId) {
                  assignments[slotId][employeeId] = createFreeAssignment();
                }
              }
            }
            return { ...day, assignments };
          })
        }
      };
      return {
        roles,
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, scopedWeekId),
        weekAuditById: clearWeekValidator(state.weekAuditById, scopedWeekId)
      };
    });
    persistSnapshot(get, set, { roles: true, currentWeek: true });
  },

  ensureWeekPlan: (week) => {
    let created = false;
    set((state) => {
      if (!state.currentAreaId) return {};
      const scopedWeekId = resolveScopedWeekId(state.currentAreaId, week.id);
      if (state.weekPlans[scopedWeekId]) return {};
      const weekConfig = getWeekConfigurationSnapshot(state, scopedWeekId);
      const weekPlans = { ...state.weekPlans };
      const emptyWeekPlan = buildEmptyWeekPlan(
        week,
        state.employees.map((employee) => employee.id),
        weekConfig.timeSlots.map((slot) => slot.id)
      );
      weekPlans[scopedWeekId] = rebuildWeekPlansFromEmployees(
        { [scopedWeekId]: emptyWeekPlan },
        state.employees,
        state.roles,
        weekConfig.timeSlots,
        weekConfig.shiftRanges,
        weekConfig.breakConfig
      )[scopedWeekId];
      created = true;
      return {
        weekPlans,
        weekAuditById: {
          ...state.weekAuditById,
          [scopedWeekId]: { createdByName: null, validatedByName: null }
        },
        weekConfigById: {
          ...state.weekConfigById,
          [scopedWeekId]: state.weekConfigById[scopedWeekId] ?? weekConfig
        }
      };
    });

    if (created) {
      persistSnapshot(get, set, { weeks: true, currentWeek: true });
    }
  },

  updateAssignment: ({ weekId, dateISO, timeSlotId, employeeId, assignment, actorName }) => {
    const stateSnapshot = get();
    const scopedWeekId = resolveScopedWeekId(stateSnapshot.currentAreaId, weekId);
    const validationKey = scopedWeekId;
    if (stateSnapshot.validatedWeekIds.includes(validationKey)) {
      return { ok: false, error: 'La semana validada está en solo lectura. Retorna la validación para editar.' };
    }
    if (!isWeekUnlockedForPlanning(stateSnapshot.weeks, stateSnapshot.validatedWeekIds, scopedWeekId)) {
      return { ok: false, error: 'Debes validar la semana anterior antes de editar o rellenar esta semana.' };
    }
    const scopedRoles = rolesForArea(stateSnapshot.roles, areaFromWeekId(scopedWeekId));
    const weekConfig = getWeekConfigurationSnapshot(stateSnapshot, scopedWeekId);
    if (assignment.roleId === null && assignment.code !== 'LIBRE') {
      return { ok: false, error: 'LIBRE debe usar código LIBRE.' };
    }
    if (assignment.isBreak && (assignment.roleId !== null || assignment.code !== 'LIBRE')) {
      return { ok: false, error: 'Break debe usar código LIBRE y no puede tener zona.' };
    }
    if (assignment.roleId !== null) {
      const accepted = validRoleCodes(scopedRoles).has(`${assignment.roleId}|${assignment.code}`);
      if (!accepted) return { ok: false, error: 'El código no pertenece al Zona seleccionado.' };
    }
    const selectedSlot = weekConfig.timeSlots.find((slot) => slot.id === timeSlotId);
    const isConfiguredBreakSlot = Boolean(selectedSlot && isTimeSlotInBreak(selectedSlot, weekConfig.breakConfig));
    const normalizedAssignment = assignment.isBreak
      ? createBreakAssignment()
      : assignment.roleId === null
        ? createFreeAssignment(true)
      : {
          ...assignment,
          isBreak: false,
          suppressConfiguredBreak: isConfiguredBreakSlot
        };

    set((state) => {
      const plan = state.weekPlans[scopedWeekId];
      if (!plan) return {};
      const days = plan.days.map((day) => {
        if (day.dateISO !== dateISO) return day;
        const assignmentsBySlot = { ...day.assignments };
        const byEmployee = { ...(assignmentsBySlot[timeSlotId] ?? {}) };
        byEmployee[employeeId] = normalizedAssignment;
        assignmentsBySlot[timeSlotId] = byEmployee;
        return { ...day, assignments: assignmentsBySlot };
      });
      const weekPlan = { ...plan, days };
      const weekPlans = { ...state.weekPlans, [scopedWeekId]: weekPlan };
      return {
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, validationKey),
        weekAuditById: clearWeekValidator(ensureWeekCreator(state.weekAuditById, validationKey, actorName), validationKey)
      };
    });
    persistSnapshot(get, set, { currentWeek: true });
    return { ok: true };
  },

  updateEmployeeDayAssignments: ({ weekId, dateISO, employeeId, assignment, timeSlotIds, actorName }) => {
    const stateSnapshot = get();
    const scopedWeekId = resolveScopedWeekId(stateSnapshot.currentAreaId, weekId);
    const validationKey = scopedWeekId;
    if (stateSnapshot.validatedWeekIds.includes(validationKey)) {
      return { ok: false, error: 'La semana validada está en solo lectura. Retorna la validación para editar.' };
    }
    if (!isWeekUnlockedForPlanning(stateSnapshot.weeks, stateSnapshot.validatedWeekIds, scopedWeekId)) {
      return { ok: false, error: 'Debes validar la semana anterior antes de editar o rellenar esta semana.' };
    }
    const scopedRoles = rolesForArea(stateSnapshot.roles, areaFromWeekId(scopedWeekId));
    if (assignment.roleId === null && assignment.code !== 'LIBRE') {
      return { ok: false, error: 'LIBRE debe usar código LIBRE.' };
    }
    if (assignment.isBreak && (assignment.roleId !== null || assignment.code !== 'LIBRE')) {
      return { ok: false, error: 'Break debe usar código LIBRE y no puede tener zona.' };
    }
    if (assignment.isBreak) {
      return { ok: false, error: 'Break excepcional solo se puede asignar a una celda.' };
    }
    if (assignment.roleId !== null) {
      const accepted = validRoleCodes(scopedRoles).has(`${assignment.roleId}|${assignment.code}`);
      if (!accepted) return { ok: false, error: 'El código no pertenece al Zona seleccionado.' };
    }
    const weekConfig = getWeekConfigurationSnapshot(stateSnapshot, scopedWeekId);

    const normalizedAssignment =
      assignment.isBreak
        ? createBreakAssignment()
        : assignment.roleId === null
          ? createFreeAssignment(true)
          : assignment;

    set((state) => {
      const plan = state.weekPlans[scopedWeekId];
      if (!plan) return {};
      const breakSlotIds = getBreakTimeSlotIds(weekConfig.timeSlots, weekConfig.breakConfig);
      const days = plan.days.map((day) => {
        if (day.dateISO !== dateISO) return day;
        const assignmentsBySlot = { ...day.assignments };
        for (const timeSlotId of timeSlotIds) {
          const byEmployee = { ...(assignmentsBySlot[timeSlotId] ?? {}) };
          byEmployee[employeeId] =
            breakSlotIds.has(timeSlotId) && normalizedAssignment.roleId !== null && normalizedAssignment.code !== 'LIBRE'
              ? createFreeAssignment()
              : normalizedAssignment.isBreak
                ? createBreakAssignment()
                : normalizedAssignment;
          assignmentsBySlot[timeSlotId] = byEmployee;
        }
        return { ...day, assignments: assignmentsBySlot };
      });
      const weekPlan = { ...plan, days };
      const weekPlans = { ...state.weekPlans, [scopedWeekId]: weekPlan };
      return {
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, validationKey),
        weekAuditById: clearWeekValidator(ensureWeekCreator(state.weekAuditById, validationKey, actorName), validationKey)
      };
    });
    persistSnapshot(get, set, { currentWeek: true });
    return { ok: true };
  },

  updateEmployeeDayByHours: ({ weekId, dateISO, employeeId, assignment, hours, actorName }) => {
    const stateSnapshot = get();
    const scopedWeekId = resolveScopedWeekId(stateSnapshot.currentAreaId, weekId);
    const validationKey = scopedWeekId;
    if (stateSnapshot.validatedWeekIds.includes(validationKey)) {
      return { ok: false, error: 'La semana validada está en solo lectura. Retorna la validación para editar.' };
    }
    if (!isWeekUnlockedForPlanning(stateSnapshot.weeks, stateSnapshot.validatedWeekIds, scopedWeekId)) {
      return { ok: false, error: 'Debes validar la semana anterior antes de editar o rellenar esta semana.' };
    }
    const scopedRoles = rolesForArea(stateSnapshot.roles, areaFromWeekId(scopedWeekId));
    const weekConfig = getWeekConfigurationSnapshot(stateSnapshot, scopedWeekId);
    const { timeSlots } = weekConfig;
    if (assignment.roleId === null && assignment.code !== 'LIBRE') {
      return { ok: false, error: 'LIBRE debe usar código LIBRE.' };
    }
    if (assignment.isBreak && (assignment.roleId !== null || assignment.code !== 'LIBRE')) {
      return { ok: false, error: 'Break debe usar código LIBRE y no puede tener zona.' };
    }
    if (assignment.roleId !== null) {
      const accepted = validRoleCodes(scopedRoles).has(`${assignment.roleId}|${assignment.code}`);
      if (!accepted) return { ok: false, error: 'El código no pertenece al Zona seleccionado.' };
    }
    if (!Number.isFinite(hours) || hours < 0) {
      return { ok: false, error: 'Las horas deben ser un número mayor o igual a 0.' };
    }

    const normalizedAssignment =
      assignment.isBreak
        ? createBreakAssignment()
        : assignment.roleId === null
          ? createFreeAssignment(true)
          : assignment;

    set((state) => {
      const plan = state.weekPlans[scopedWeekId];
      if (!plan) return {};
      const orderedSlots = getAssignableTimeSlots(timeSlots);
      const breakSlotIds = getBreakTimeSlotIds(orderedSlots, weekConfig.breakConfig);

      const days = plan.days.map((day) => {
        if (day.dateISO !== dateISO) return day;
        let remaining = hours;
        const assignmentsBySlot = { ...day.assignments };

        for (const slot of orderedSlots) {
          const timeSlotId = slot.id;
          const byEmployee = { ...(assignmentsBySlot[timeSlotId] ?? {}) };
          if (breakSlotIds.has(timeSlotId)) {
            byEmployee[employeeId] = createFreeAssignment();
            assignmentsBySlot[timeSlotId] = byEmployee;
            continue;
          }
          const slotHours = getSlotDurationHours(slot.start, slot.end);
          const shouldApplyInSlot = remaining > 0 && slotHours > 0;

          if (normalizedAssignment.isBreak) {
            byEmployee[employeeId] = createBreakAssignment();
            assignmentsBySlot[timeSlotId] = byEmployee;
            continue;
          }

          if (normalizedAssignment.roleId === null) {
            // LIBRE + N horas: solo libera los primeros N bloques y mantiene intacto el resto del día.
            if (shouldApplyInSlot) {
              byEmployee[employeeId] = createFreeAssignment(true);
              assignmentsBySlot[timeSlotId] = byEmployee;
              remaining = Number((remaining - slotHours).toFixed(4));
            }
            continue;
          }

          // Zona + N horas: asigna los primeros N bloques y libera el resto del día.
          byEmployee[employeeId] = shouldApplyInSlot ? normalizedAssignment : createFreeAssignment();
          assignmentsBySlot[timeSlotId] = byEmployee;

          if (shouldApplyInSlot) {
            remaining = Number((remaining - slotHours).toFixed(4));
          }
        }

        return { ...day, assignments: assignmentsBySlot };
      });

      const weekPlan = { ...plan, days };
      const weekPlans = { ...state.weekPlans, [scopedWeekId]: weekPlan };
      return {
        weekPlans,
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, validationKey),
        weekAuditById: clearWeekValidator(ensureWeekCreator(state.weekAuditById, validationKey, actorName), validationKey)
      };
    });
    persistSnapshot(get, set, { currentWeek: true });
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

    const stateSnapshot = get();
    const scopedWeekId = getSelectedScopedWeekId(stateSnapshot);
    if (!scopedWeekId) {
      return { ok: false, error: 'No existe una semana seleccionada.' };
    }
    if (stateSnapshot.validatedWeekIds.includes(scopedWeekId)) {
      return { ok: false, error: 'La semana seleccionada ya está validada. Desvalídala para cambiar su configuración.' };
    }

    set((state) => {
      const areaId = state.currentAreaId;
      const employeeIds = state.employees.map((employee) => employee.id);
      const targetWeekIds = getConfigurationTargetWeekIds(state, areaId);
      const remappedWeekPlansForUnlocked = remapWeekPlansToTimeSlotsForArea(
        state.weekPlans,
        nextTimeSlots,
        employeeIds,
        areaId,
        state.validatedWeekIds,
        targetWeekIds
      );
      const currentWeekConfig = getWeekConfigurationSnapshot(state, scopedWeekId);
      const normalizedShiftRanges = normalizeShiftRangesToPlanningBounds(currentWeekConfig.shiftRanges, startHour, endHour);
      const normalizedBreakConfig = normalizeBreakConfigToPlanningBounds(currentWeekConfig.breakConfig, startHour, endHour);
      const nextTimeslotsByArea = { ...state.timeSlotsByArea, [areaId]: nextTimeSlots };
      const nextShiftRangesByArea = { ...state.shiftRangesByArea, [areaId]: normalizedShiftRanges };
      const nextBreakConfigByArea = { ...state.breakConfigByArea, [areaId]: normalizedBreakConfig };
      const nextWeekConfigById = {
        ...state.weekConfigById,
        [scopedWeekId]: {
          ...currentWeekConfig,
          timeSlots: nextTimeSlots,
          shiftRanges: normalizedShiftRanges,
          breakConfig: normalizedBreakConfig
        }
      };
      const rebuiltWeekPlans = targetWeekIds.size
        ? rebuildWeekPlansForArea(
            remappedWeekPlansForUnlocked,
            state.employees,
            state.roles,
            areaId,
            state.validatedWeekIds,
            nextWeekConfigById,
            nextTimeslotsByArea,
            nextShiftRangesByArea,
            nextBreakConfigByArea,
            targetWeekIds
          )
        : state.weekPlans;
      return {
        timeSlots: areaId === state.currentAreaId ? nextTimeSlots : state.timeSlots,
        timeSlotsByArea: nextTimeslotsByArea,
        shiftRanges: areaId === state.currentAreaId ? normalizedShiftRanges : state.shiftRanges,
        shiftRangesByArea: nextShiftRangesByArea,
        breakConfig: areaId === state.currentAreaId ? normalizedBreakConfig : state.breakConfig,
        breakConfigByArea: nextBreakConfigByArea,
        weekConfigById: nextWeekConfigById,
        weekPlans: rebuiltWeekPlans
      };
    });
    persistSnapshot(get, set, { currentWeek: true, areaSettings: true });
    return { ok: true };
  },

  setShiftRanges: (input) => {
    const stateSnapshot = get();
    const scopedWeekId = getSelectedScopedWeekId(stateSnapshot);
    if (!scopedWeekId) {
      return { ok: false, error: 'No existe una semana seleccionada.' };
    }
    if (stateSnapshot.validatedWeekIds.includes(scopedWeekId)) {
      return { ok: false, error: 'La semana seleccionada ya está validada. Desvalídala para cambiar su configuración.' };
    }
    const currentWeekConfig = getWeekConfigurationSnapshot(stateSnapshot, scopedWeekId);
    const { timeSlots } = currentWeekConfig;
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
      const areaId = state.currentAreaId;
      const targetWeekIds = getConfigurationTargetWeekIds(state, areaId);
      const nextShiftRangesByArea = { ...state.shiftRangesByArea, [areaId]: normalized };
      const nextWeekConfigById = {
        ...state.weekConfigById,
        [scopedWeekId]: {
          ...getWeekConfigurationSnapshot(state, scopedWeekId),
          shiftRanges: normalized
        }
      };
      const weekPlans = rebuildWeekPlansForArea(
        state.weekPlans,
        state.employees,
        state.roles,
        areaId,
        state.validatedWeekIds,
        nextWeekConfigById,
        state.timeSlotsByArea,
        nextShiftRangesByArea,
        state.breakConfigByArea,
        targetWeekIds
      );
      return {
        shiftRanges: areaId === state.currentAreaId ? normalized : state.shiftRanges,
        shiftRangesByArea: nextShiftRangesByArea,
        weekConfigById: nextWeekConfigById,
        weekPlans
      };
    });
    persistSnapshot(get, set, { currentWeek: true, areaSettings: true });
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

    const stateSnapshot = get();
    const scopedWeekId = getSelectedScopedWeekId(stateSnapshot);
    if (!scopedWeekId) {
      return { ok: false, error: 'No existe una semana seleccionada.' };
    }
    if (stateSnapshot.validatedWeekIds.includes(scopedWeekId)) {
      return { ok: false, error: 'La semana seleccionada ya está validada. Desvalídala para cambiar su configuración.' };
    }

    set((state) => {
      const areaId = state.currentAreaId;
      return {
        validationRequirements: areaId === state.currentAreaId ? sanitized : state.validationRequirements,
        validationRequirementsByArea: { ...state.validationRequirementsByArea, [areaId]: sanitized },
        weekConfigById: {
          ...state.weekConfigById,
          [scopedWeekId]: {
            ...getWeekConfigurationSnapshot(state, scopedWeekId),
            validationRequirements: sanitized
          }
        }
      };
    });
    persistSnapshot(get, set, { currentWeek: true, areaSettings: true });
    return { ok: true };
  },

  setBreakConfig: (input) => {
    const stateSnapshot = get();
    const scopedWeekId = getSelectedScopedWeekId(stateSnapshot);
    if (!scopedWeekId) {
      return { ok: false, error: 'No existe una semana seleccionada.' };
    }
    if (stateSnapshot.validatedWeekIds.includes(scopedWeekId)) {
      return { ok: false, error: 'La semana seleccionada ya está validada. Desvalídala para cambiar su configuración.' };
    }
    const currentWeekConfig = getWeekConfigurationSnapshot(stateSnapshot, scopedWeekId);
    const { timeSlots } = currentWeekConfig;
    const { startHour, endHour } = getPlanningHoursBounds(timeSlots);
    const normalized = normalizeBreakConfigToPlanningBounds(input, startHour, endHour);
    const inputChanged =
      normalized.startHour !== input.startHour ||
      normalized.endHour !== input.endHour;
    if (inputChanged) {
      return { ok: false, error: 'El horario de refrigerio debe estar dentro del rango de planificación y ser válido.' };
    }

    set((state) => {
      const areaId = state.currentAreaId;
      const targetWeekIds = getConfigurationTargetWeekIds(state, areaId);
      const nextBreakConfigByArea = { ...state.breakConfigByArea, [areaId]: normalized };
      const nextWeekConfigById = {
        ...state.weekConfigById,
        [scopedWeekId]: {
          ...getWeekConfigurationSnapshot(state, scopedWeekId),
          breakConfig: normalized
        }
      };
      const weekPlans = rebuildWeekPlansForArea(
        state.weekPlans,
        state.employees,
        state.roles,
        areaId,
        state.validatedWeekIds,
        nextWeekConfigById,
        state.timeSlotsByArea,
        state.shiftRangesByArea,
        nextBreakConfigByArea,
        targetWeekIds
      );
      return {
        breakConfig: areaId === state.currentAreaId ? normalized : state.breakConfig,
        breakConfigByArea: nextBreakConfigByArea,
        weekConfigById: nextWeekConfigById,
        weekPlans
      };
    });
    persistSnapshot(get, set, { currentWeek: true, areaSettings: true });
    return { ok: true };
  },

  migrateFromPreviousWeek: () => {
    const stateSnapshot = get();
    const scopedWeekId = getSelectedScopedWeekId(stateSnapshot);
    if (!scopedWeekId) {
      return { ok: false, error: 'No existe una semana seleccionada.' };
    }
    if (stateSnapshot.validatedWeekIds.includes(scopedWeekId)) {
      return { ok: false, error: 'La semana actual ya está validada. No se puede sobrescribir.' };
    }
    // Find previous week
    const currentBaseWeekId = baseWeekIdFromScopedWeekId(scopedWeekId);
    const areaId = areaFromWeekId(scopedWeekId);
    const orderedWeeks = [...stateSnapshot.weeks].sort((a, b) => a.startDateISO.localeCompare(b.startDateISO));
    const currentIndex = orderedWeeks.findIndex((week) => week.id === currentBaseWeekId);
    if (currentIndex <= 0) {
      return { ok: false, error: 'No existe una semana anterior para migrar.' };
    }
    const previousWeek = orderedWeeks[currentIndex - 1];
    const previousScopedWeekId = toScopedWeekId(areaId, previousWeek.id);
    const previousPlan = stateSnapshot.weekPlans[previousScopedWeekId];
    if (!previousPlan || previousPlan.days.length === 0) {
      return { ok: false, error: 'La semana anterior no tiene planificación.' };
    }

    set((state) => {
      const currentPlan = state.weekPlans[scopedWeekId];
      if (!currentPlan) return {};
      // Copy assignments from previous week, mapping by day index (Mon→Mon, Tue→Tue, etc.)
      const migratedDays = currentPlan.days.map((day, dayIndex) => {
        const sourceDay = previousPlan.days[dayIndex];
        if (!sourceDay) return day;
        return {
          ...day,
          assignments: { ...sourceDay.assignments }
        };
      });
      const migratedPlan: WeekPlan = {
        ...currentPlan,
        days: migratedDays,
        restDayOverrides: previousPlan.restDayOverrides ? { ...previousPlan.restDayOverrides } : currentPlan.restDayOverrides
      };
      return {
        weekPlans: { ...state.weekPlans, [scopedWeekId]: migratedPlan },
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, scopedWeekId)
      };
    });
    persistSnapshot(get, set, { currentWeek: true });
    return { ok: true };
  },

  setExceptionalRestDay: ({ weekId, dateISO, employeeId, active }) => {
    const stateSnapshot = get();
    const scopedWeekId = resolveScopedWeekId(stateSnapshot.currentAreaId, weekId);
    if (stateSnapshot.validatedWeekIds.includes(scopedWeekId)) {
      return { ok: false, error: 'La semana validada está en solo lectura.' };
    }
    if (!isWeekUnlockedForPlanning(stateSnapshot.weeks, stateSnapshot.validatedWeekIds, scopedWeekId)) {
      return { ok: false, error: 'No se puede modificar esta semana.' };
    }
    const dayNumber = parseISODateToDay(dateISO);
    set((state) => {
      const plan = state.weekPlans[scopedWeekId];
      if (!plan) return {};
      const restDayOverrides = { ...(plan.restDayOverrides ?? {}) };
      if (active) {
        restDayOverrides[employeeId] = dayNumber;
      } else {
        delete restDayOverrides[employeeId];
      }
      // Al activar: limpiar todas las celdas del nuevo día de descanso para ese colaborador
      const days = plan.days.map((day) => {
        if (!active || parseISODateToDay(day.dateISO) !== dayNumber) return day;
        const assignments = { ...day.assignments };
        for (const slotId of Object.keys(assignments)) {
          assignments[slotId] = { ...(assignments[slotId] ?? {}), [employeeId]: createFreeAssignment() };
        }
        return { ...day, assignments };
      });
      return {
        weekPlans: {
          ...state.weekPlans,
          [scopedWeekId]: { ...plan, days, restDayOverrides }
        }
      };
    });
    persistSnapshot(get, set, { currentWeek: true });
    return { ok: true };
  },

  validateWeekPlan: (weekId, actorName) => {
    if (!weekId.trim()) {
      return { ok: false, error: 'Semana inválida para validar.' };
    }
    const stateSnapshot = get();
    const scopedWeekId = resolveScopedWeekId(stateSnapshot.currentAreaId, weekId);
    const validationKey = scopedWeekId;
    if (!stateSnapshot.weekPlans[scopedWeekId]) {
      return { ok: false, error: 'No existe planificación para esa semana.' };
    }
    if (stateSnapshot.validatedWeekIds.includes(validationKey)) {
      return { ok: false, error: 'La semana ya está validada.' };
    }
    if (!isWeekUnlockedForPlanning(stateSnapshot.weeks, stateSnapshot.validatedWeekIds, scopedWeekId)) {
      return { ok: false, error: 'Debes validar la semana anterior antes de validar esta semana.' };
    }

    set((state) => {
      if (!isWeekUnlockedForPlanning(state.weeks, state.validatedWeekIds, scopedWeekId)) return {};
      const auditWithCreator = ensureWeekCreator(state.weekAuditById, validationKey, actorName);
      const currentAudit = auditWithCreator[validationKey] ?? { createdByName: null, validatedByName: null };

      // Generar la semana siguiente: copiar la planificación del área validada y mantener listas las demás áreas
      const baseWeekId = baseWeekIdFromScopedWeekId(scopedWeekId);
      const currentWeek = state.weeks.find((w) => w.id === baseWeekId);
      let nextWeeks = state.weeks;
      let nextWeekPlans = { ...state.weekPlans };
      let nextWeekConfigById = { ...state.weekConfigById };
      const inactiveEmployeeIdsSnapshot = state.employees
        .filter((employee) => !employee.active)
        .map((employee) => employee.id);
      const nextWeekAuditById: typeof state.weekAuditById = {
        ...auditWithCreator,
        [validationKey]: {
          ...currentAudit,
          validatedByName: actorName?.trim() || 'No registrado',
          inactiveEmployeeIds: inactiveEmployeeIdsSnapshot
        }
      };

      if (currentWeek) {
        const nextStartISO = formatISO(addWeeks(parseISO(currentWeek.startDateISO), 1), { representation: 'date' });
        const existResult = ensureWeekExists(state.weeks, nextStartISO);
        nextWeeks = existResult.weeks;
        const nextWeek = existResult.week;

        // Ensure next week has empty plans for all areas (no copy from validated week)
        for (const areaId of getAreaCodes(state)) {
          const nextScopedId = toScopedWeekId(areaId, nextWeek.id);
          const currentScopedId = toScopedWeekId(areaId, baseWeekId);
          const weekConfig = getWeekConfigurationSnapshot(state, currentScopedId);
          nextWeekConfigById[nextScopedId] = nextWeekConfigById[nextScopedId] ?? cloneWeekConfigurationSnapshot(weekConfig);

          if (!nextWeekPlans[nextScopedId]) {
            nextWeekPlans[nextScopedId] = buildEmptyWeekPlan(
              nextWeek,
              state.employees.map((e) => e.id),
              weekConfig.timeSlots.map((s) => s.id)
            );
          }

          if (!nextWeekAuditById[nextScopedId]) {
            nextWeekAuditById[nextScopedId] = { createdByName: null, validatedByName: null };
          }
        }
      }

      return {
        weeks: nextWeeks,
        validatedWeekIds: [...state.validatedWeekIds, validationKey],
        weekAuditById: nextWeekAuditById,
        weekConfigById: {
          ...nextWeekConfigById,
          [scopedWeekId]: getWeekConfigurationSnapshot(state, scopedWeekId)
        },
        weekPlans: nextWeekPlans
      };
    });

    // Persistir la semana actual validada + la semana siguiente generada (todas las áreas)
    const stateAfterValidation = get();
    const baseWeekIdAfter = baseWeekIdFromScopedWeekId(resolveScopedWeekId(stateAfterValidation.currentAreaId, weekId));
    const validatedWeek = stateAfterValidation.weeks.find((w) => w.id === baseWeekIdAfter);
    const nextWeekExtraIds: string[] = [];
    if (validatedWeek) {
      const nextStartISO = formatISO(addWeeks(parseISO(validatedWeek.startDateISO), 1), { representation: 'date' });
      const nextWeek = stateAfterValidation.weeks.find((w) => w.startDateISO === nextStartISO);
      if (nextWeek) {
        for (const areaId of getAreaCodes(stateAfterValidation)) {
          nextWeekExtraIds.push(toScopedWeekId(areaId, nextWeek.id));
        }
      }
    }
    persistSnapshot(get, set, { currentWeek: true, weeks: true, extraWeekIds: nextWeekExtraIds });
    return { ok: true };
  },

  desvalidateWeekPlan: (weekId) => {
    if (!weekId.trim()) {
      return { ok: false, error: 'Semana inválida para retornar validación.' };
    }

    set((state) => {
      const scopedWeekId = resolveScopedWeekId(state.currentAreaId, weekId);
      const validationKey = scopedWeekId;
      if (!state.weekPlans[scopedWeekId]) return {};
      if (!state.validatedWeekIds.includes(validationKey)) return {};
      return {
        validatedWeekIds: invalidateWeekValidation(state.validatedWeekIds, validationKey),
        weekAuditById: clearWeekValidator(state.weekAuditById, validationKey),
        weekConfigById: state.weekConfigById
      };
    });
    persistSnapshot(get, set, { currentWeek: true });
    return { ok: true };
  }
}));

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function isWeekValidatedForCompany(
  validatedWeekIds: string[],
  scopedWeekId: string | null,
  _companyId?: string | null
): boolean {
  if (!scopedWeekId) return false;
  return validatedWeekIds.includes(scopedWeekId);
}

export function getWeekAuditForCompany(
  weekAuditById: Record<string, WeekAudit>,
  scopedWeekId: string | null,
  _companyId?: string | null
): WeekAudit | undefined {
  if (!scopedWeekId) return undefined;
  return weekAuditById[scopedWeekId];
}

// Re-initialize store when the selected company changes.
useAuthStore.subscribe((state, prevState) => {
  if (state.selectedGeoVictoriaCompanyId !== prevState.selectedGeoVictoriaCompanyId) {
    const store = useAppStore.getState();
    if (store.hydrated) {
      useAppStore.setState({ hydrated: false });
      store.initialize();
    }
  }
});

export async function exportPersistSnapshot(): Promise<void> {
  const state = useAppStore.getState();
  await savePlannerState(toPersistableState(state), getSelectedCompanyId());
}
