import type { BreakConfig, Employee, Role, TimeSlot, WeekPlan } from '../types';
import { isTimeSlotInBreak } from './breaks';

export type GeoMigrationRow = {
  key: string;
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
  const orderedSlots = [...timeSlots].sort((a, b) => a.order - b.order).filter((slot) => !isTimeSlotInBreak(slot, breakConfig));
  const slotIndexById = new Map(orderedSlots.map((slot, index) => [slot.id, index]));
  const rows: GeoMigrationRow[] = [];

  for (const employee of employees) {
    if (!employee.active) continue;

    for (const day of weekPlan.days) {
      let currentSegment:
        | {
            startHour: string;
            endHour: string;
            roleName: string;
            previousSlotIndex: number;
          }
        | null = null;

      const flushCurrentSegment = (): void => {
        if (!currentSegment) return;
        const warnings: string[] = [];
        if (!employee.companyId) warnings.push('Sin company asignada.');
        if (!employee.identityDocument) warnings.push('Sin DNI.');

        const companyLabel = buildCompanyLabel(employee);
        rows.push({
          key: `${employee.id}:${day.dateISO}:${currentSegment.startHour}:${currentSegment.endHour}`,
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
          roleName: currentSegment.roleName,
          custom: `${employee.code ?? employee.name}-${currentSegment.startHour}-${currentSegment.endHour}`,
          canMigrate: warnings.length === 0,
          warnings
        });
        currentSegment = null;
      };

      for (const slot of orderedSlots) {
        const assignment = day.assignments[slot.id]?.[employee.id];
        const slotIndex = slotIndexById.get(slot.id);
        if (slotIndex === undefined) continue;

        if (!assignment || assignment.roleId === null || assignment.code === 'LIBRE') {
          flushCurrentSegment();
          continue;
        }

        const roleName = roleById.get(assignment.roleId) ?? assignment.code;
        if (!currentSegment) {
          currentSegment = {
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
          currentSegment.previousSlotIndex + 1 === slotIndex &&
          previousEndMinutes !== null &&
          currentStartMinutes !== null &&
          previousEndMinutes === currentStartMinutes;

        if (!isContiguous) {
          flushCurrentSegment();
          currentSegment = {
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
