import type { BreakConfig, Employee, Role, TimeSlot, WeekPlan } from '../types';
import { isTimeSlotInBreak } from './breaks';
import { isRestDayForDate } from './weekdays';

export type GeoMigrationRow = {
  key: string;
  assignmentType: 'work' | 'rest' | 'free';
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  companyId: string;
  companyLabel: string;
  userIdentifier: string;
  dateISO: string;
  dayName: string;
  startHour: string;
  endHour: string;
  breakStartHour?: string;
  breakEndHour?: string;
  roleName: string;
  custom: string;
  canMigrate: boolean;
  warnings: string[];
};

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function buildCompanyLabel(employee: Employee): string {
  if (employee.companyAlias && employee.companyName) {
    return `${employee.companyAlias} - ${employee.companyName}`;
  }
  return employee.companyName ?? employee.companyAlias ?? '-';
}

export function buildGeoMigrationRows(
  employees: Employee[],
  roles: Role[],
  timeSlots: TimeSlot[],
  breakConfig: BreakConfig,
  weekPlan?: WeekPlan
): GeoMigrationRow[] {
  if (!weekPlan) return [];

  const roleById = new Map(roles.map((role) => [role.id, role.name]));
  const orderedSlots = [...timeSlots].sort((a, b) => a.order - b.order);
  const slotIndexById = new Map(orderedSlots.map((slot, index) => [slot.id, index]));
  const rows: GeoMigrationRow[] = [];

  for (const employee of employees) {
    if (!employee.active) continue;

    for (const day of weekPlan.days) {
      let currentSegment:
        | {
            assignmentType: 'work' | 'free';
            startHour: string;
            endHour: string;
            roleName: string;
            previousSlotIndex: number;
            breakStartHour?: string;
            breakEndHour?: string;
          }
        | null = null;
      let pendingBreak:
        | {
            startHour: string;
            endHour: string;
            lastSlotIndex: number;
          }
        | null = null;
      let hasWorkAssignments = false;
      let hasAnyAssignments = false;
      const employeeRestDay = isRestDayForDate(day.dateISO, employee.restDay);

      const flushCurrentSegment = (): void => {
        if (!currentSegment) return;
        const warnings: string[] = [];
        if (!employee.companyId) warnings.push('Sin company asignada.');
        if (!employee.identityDocument) warnings.push('Sin DNI.');

        const companyLabel = buildCompanyLabel(employee);
        rows.push({
          key: `${employee.id}:${day.dateISO}:${currentSegment.startHour}:${currentSegment.endHour}:${currentSegment.breakStartHour ?? ''}:${currentSegment.breakEndHour ?? ''}`,
          assignmentType: currentSegment.assignmentType,
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.code ?? '-',
          companyId: employee.companyId ?? '',
          companyLabel,
          userIdentifier: employee.identityDocument?.trim() ?? '',
          dateISO: day.dateISO,
          dayName: day.dayName,
          startHour: currentSegment.startHour,
          endHour: currentSegment.endHour,
          breakStartHour: currentSegment.breakStartHour,
          breakEndHour: currentSegment.breakEndHour,
          roleName: currentSegment.roleName,
          custom: `${employee.code ?? employee.name}-${currentSegment.startHour}-${currentSegment.endHour}`,
          canMigrate: warnings.length === 0,
          warnings
        });
        currentSegment = null;
        pendingBreak = null;
      };

      for (const slot of orderedSlots) {
        const assignment = day.assignments[slot.id]?.[employee.id];
        const slotIndex = slotIndexById.get(slot.id);
        if (slotIndex === undefined) continue;
        const isBreakSlot = isTimeSlotInBreak(slot, breakConfig);

        if (!assignment || (assignment.roleId === null && assignment.code === 'LIBRE')) {
          if (isBreakSlot && currentSegment) {
            const breakIsContiguous = pendingBreak
              ? pendingBreak.lastSlotIndex + 1 === slotIndex
              : currentSegment.previousSlotIndex + 1 === slotIndex;

            if (breakIsContiguous) {
              pendingBreak = {
                startHour: pendingBreak?.startHour ?? slot.start,
                endHour: slot.end,
                lastSlotIndex: slotIndex
              };
              continue;
            }
          }
          flushCurrentSegment();
          continue;
        }

        hasAnyAssignments = true;
        const segmentType = 'work';
        const roleName = roleById.get(assignment.roleId) ?? assignment.code;
        hasWorkAssignments = true;
        if (!currentSegment) {
          currentSegment = {
            assignmentType: segmentType,
            startHour: slot.start,
            endHour: slot.end,
            roleName,
            previousSlotIndex: slotIndex
          };
          continue;
        }

        if (pendingBreak) {
          const resumesAfterBreak = pendingBreak.lastSlotIndex + 1 === slotIndex;
          if (resumesAfterBreak) {
            currentSegment = {
              ...currentSegment,
              endHour: slot.end,
              previousSlotIndex: slotIndex,
              breakStartHour: currentSegment.breakStartHour ?? pendingBreak.startHour,
              breakEndHour: pendingBreak.endHour
            };
            pendingBreak = null;
            continue;
          }

          flushCurrentSegment();
          currentSegment = {
            assignmentType: segmentType,
            startHour: slot.start,
            endHour: slot.end,
            roleName,
            previousSlotIndex: slotIndex
          };
          continue;
        }

        const previousEndMinutes = parseTimeToMinutes(currentSegment.endHour);
        const currentStartMinutes = parseTimeToMinutes(slot.start);
        const isContiguous =
          currentSegment.assignmentType === segmentType &&
          currentSegment.previousSlotIndex + 1 === slotIndex &&
          previousEndMinutes !== null &&
          currentStartMinutes !== null &&
          previousEndMinutes === currentStartMinutes;

        if (!isContiguous) {
          flushCurrentSegment();
          currentSegment = {
            assignmentType: segmentType,
            startHour: slot.start,
            endHour: slot.end,
            roleName,
            previousSlotIndex: slotIndex
          };
          continue;
        }

        currentSegment = {
          ...currentSegment,
          endHour: slot.end,
          previousSlotIndex: slotIndex
        };
      }

      flushCurrentSegment();

      if (employeeRestDay && !hasWorkAssignments) {
        const warnings: string[] = [];
        if (!employee.companyId) warnings.push('Sin company asignada.');
        if (!employee.identityDocument) warnings.push('Sin DNI.');

        rows.push({
          key: `${employee.id}:${day.dateISO}:rest`,
          assignmentType: 'rest',
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.code ?? '-',
          companyId: employee.companyId ?? '',
          companyLabel: buildCompanyLabel(employee),
          userIdentifier: employee.identityDocument?.trim() ?? '',
          dateISO: day.dateISO,
          dayName: day.dayName,
          startHour: '',
          endHour: '',
          roleName: 'Descanso',
          custom: `${employee.code ?? employee.name}-descanso-${day.dateISO}`.slice(0, 20),
          canMigrate: warnings.length === 0,
          warnings
        });
      } else if (!hasAnyAssignments && !hasWorkAssignments) {
        const warnings: string[] = [];
        if (!employee.companyId) warnings.push('Sin company asignada.');
        if (!employee.identityDocument) warnings.push('Sin DNI.');

        rows.push({
          key: `${employee.id}:${day.dateISO}:free`,
          assignmentType: 'free',
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.code ?? '-',
          companyId: employee.companyId ?? '',
          companyLabel: buildCompanyLabel(employee),
          userIdentifier: employee.identityDocument?.trim() ?? '',
          dateISO: day.dateISO,
          dayName: day.dayName,
          startHour: '',
          endHour: '',
          roleName: 'SIN ASIGNAR',
          custom: `${employee.code ?? employee.name}-libre-${day.dateISO}`.slice(0, 20),
          canMigrate: warnings.length === 0,
          warnings
        });
      }
    }
  }

  return rows.sort((a, b) => {
    const dateOrder = a.dateISO.localeCompare(b.dateISO);
    if (dateOrder !== 0) return dateOrder;
    const startOrder = a.startHour.localeCompare(b.startHour);
    if (startOrder !== 0) return startOrder;
    return a.employeeName.localeCompare(b.employeeName);
  });
}
