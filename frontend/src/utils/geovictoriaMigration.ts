import type { BreakConfig, Employee, Role, TimeSlot, WeekPlan } from '../types';
import { isTimeSlotInBreak } from './breaks';
import { isBreakAssignment, isOvertimeAssignment, isWorkAssignment } from './assignments';
import { isAnyRestDayForDate, isRestDayForDate } from './weekdays';

export type GeoMigrationRow = {
  key: string;
  assignmentType: 'work' | 'rest' | 'free';
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  companyAlias?: string;
  companyId: string;
  companyLabel: string;
  costCenterCode?: string;
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
  crossesMidnight?: boolean;
};

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function addOneDayISO(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mergeCrossMidnightRows(rows: GeoMigrationRow[]): GeoMigrationRow[] {
  const workByLookup = new Map<string, GeoMigrationRow>();
  for (const row of rows) {
    if (row.assignmentType !== 'work') continue;
    workByLookup.set(`${row.employeeId}::${row.dateISO}::${row.startHour}`, row);
  }

  const removedKeys = new Set<string>();
  for (const row of rows) {
    if (row.assignmentType !== 'work') continue;
    if (removedKeys.has(row.key)) continue;
    if (row.endHour !== '24:00') continue;
    const nextDate = addOneDayISO(row.dateISO);
    const candidate = workByLookup.get(`${row.employeeId}::${nextDate}::00:00`);
    if (!candidate) continue;
    if (removedKeys.has(candidate.key)) continue;
    if (candidate.roleName !== row.roleName) continue;

    row.endHour = candidate.endHour;
    row.crossesMidnight = true;
    row.custom = `${row.employeeCode}-${row.startHour}-${row.endHour}`.slice(0, 20);
    if (!row.breakStartHour && candidate.breakStartHour) {
      row.breakStartHour = candidate.breakStartHour;
      row.breakEndHour = candidate.breakEndHour;
    }
    // El merge cambia endHour (y a veces el break), por lo que la key debe
    // recalcularse para que coincida con la key derivada del resultado
    // (que usa la hora de salida fusionada). Sin esto, los turnos de
    // madrugada nunca encuentran su estado de migracion.
    row.key = `${row.employeeId}:${row.dateISO}:${row.startHour}:${row.endHour}:${row.breakStartHour ?? ''}:${row.breakEndHour ?? ''}`;
    removedKeys.add(candidate.key);
  }

  return rows.filter((row) => !removedKeys.has(row.key));
}

function buildCompanyLabel(employee: Employee): string {
  const companyAlias = employee.companyAlias;
  const companyName = employee.companyName;
  if (companyAlias && companyName) {
    return `${companyAlias} - ${companyName}`;
  }
  return companyName ?? companyAlias ?? '-';
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
      const overrideList = weekPlan.restDayOverrides?.[employee.id];
      const employeeRestDay =
        overrideList && overrideList.length > 0
          ? isAnyRestDayForDate(day.dateISO, overrideList)
          : isRestDayForDate(day.dateISO, employee.restDay);

      const flushCurrentSegment = (): void => {
        if (!currentSegment) return;
        const warnings: string[] = [];
        if (!employee.companyId) warnings.push('Sin company asignada.');
        if (!employee.identityDocument) warnings.push('Sin DNI.');
        if ((employee.companyAlias ?? '').trim().toLowerCase() === 'recibo' && !employee.geoVictoriaCostCenterCode?.trim()) {
          warnings.push('Sin centro de costo de Recibo.');
        }

        const companyLabel = buildCompanyLabel(employee);
        rows.push({
          key: `${employee.id}:${day.dateISO}:${currentSegment.startHour}:${currentSegment.endHour}:${currentSegment.breakStartHour ?? ''}:${currentSegment.breakEndHour ?? ''}`,
          assignmentType: currentSegment.assignmentType,
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.code ?? '-',
          companyAlias: employee.companyAlias,
          companyId: employee.companyId ?? '',
          companyLabel,
          costCenterCode: employee.geoVictoriaCostCenterCode,
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
        const isBreakSlot = isTimeSlotInBreak(slot, breakConfig) || isBreakAssignment(assignment);

        // Hora extra: NO entra al turno (Caso A). Va aparte como Overtime/Add.
        if (isOvertimeAssignment(assignment)) {
          flushCurrentSegment();
          hasAnyAssignments = true;
          continue;
        }

        if (!assignment || isBreakAssignment(assignment) || (assignment.roleId === null && assignment.code === 'LIBRE')) {
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

        if (!isWorkAssignment(assignment)) {
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
        if ((employee.companyAlias ?? '').trim().toLowerCase() === 'recibo' && !employee.geoVictoriaCostCenterCode?.trim()) {
          warnings.push('Sin centro de costo de Recibo.');
        }

        rows.push({
          key: `${employee.id}:${day.dateISO}:rest`,
          assignmentType: 'rest',
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.code ?? '-',
          companyAlias: employee.companyAlias,
          companyId: employee.companyId ?? '',
          companyLabel: buildCompanyLabel(employee),
          costCenterCode: employee.geoVictoriaCostCenterCode,
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
        if ((employee.companyAlias ?? '').trim().toLowerCase() === 'recibo' && !employee.geoVictoriaCostCenterCode?.trim()) {
          warnings.push('Sin centro de costo de Recibo.');
        }

        rows.push({
          key: `${employee.id}:${day.dateISO}:free`,
          assignmentType: 'free',
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.code ?? '-',
          companyAlias: employee.companyAlias,
          companyId: employee.companyId ?? '',
          companyLabel: buildCompanyLabel(employee),
          costCenterCode: employee.geoVictoriaCostCenterCode,
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

  const merged = mergeCrossMidnightRows(rows);
  return merged.sort((a, b) => {
    const dateOrder = a.dateISO.localeCompare(b.dateISO);
    if (dateOrder !== 0) return dateOrder;
    const startOrder = a.startHour.localeCompare(b.startHour);
    if (startOrder !== 0) return startOrder;
    return a.employeeName.localeCompare(b.employeeName);
  });
}

export type GeoOvertimeRow = {
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyAlias?: string;
  userIdentifier: string;
  dateISO: string;
  /** Minutos de hora extra antes de la jornada normal. */
  beforeMinutes: number;
  /** Minutos de hora extra después de la jornada normal. */
  afterMinutes: number;
};

export function minutesToHHMM(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Recorre las celdas marcadas como hora extra (Assignment.overtime) y suma la duración total
 * por colaborador / día, separada en antes/después de la jornada normal. GeoVictoria aplica los
 * tramos (25% primeras 2h, 35% resto) automáticamente, así que solo se envía la duración total
 * (un registro por día/lado para no sobrescribir).
 */
export function buildOvertimeRows(
  employees: Employee[],
  timeSlots: TimeSlot[],
  weekPlan?: WeekPlan
): GeoOvertimeRow[] {
  if (!weekPlan) return [];

  const orderedSlots = [...timeSlots].sort((a, b) => a.order - b.order);
  const rows: GeoOvertimeRow[] = [];

  for (const employee of employees) {
    if (!employee.active) continue;

    for (const day of weekPlan.days) {
      // Inicio de la jornada normal (celdas de trabajo que NO son hora extra).
      let workStart: number | null = null;
      for (const slot of orderedSlots) {
        const assignment = day.assignments[slot.id]?.[employee.id];
        if (!isWorkAssignment(assignment) || isOvertimeAssignment(assignment)) continue;
        const start = parseTimeToMinutes(slot.start);
        if (start === null) continue;
        if (workStart === null || start < workStart) workStart = start;
      }

      let beforeMinutes = 0;
      let afterMinutes = 0;
      for (const slot of orderedSlots) {
        const assignment = day.assignments[slot.id]?.[employee.id];
        if (!isOvertimeAssignment(assignment)) continue;
        const start = parseTimeToMinutes(slot.start);
        const end = parseTimeToMinutes(slot.end);
        if (start === null || end === null || end <= start) continue;
        if (workStart !== null && end <= workStart) {
          beforeMinutes += end - start;
        } else {
          afterMinutes += end - start;
        }
      }

      if (beforeMinutes <= 0 && afterMinutes <= 0) continue;

      rows.push({
        employeeId: employee.id,
        employeeName: employee.name,
        companyId: employee.companyId ?? '',
        companyAlias: employee.companyAlias,
        userIdentifier: employee.identityDocument?.trim() ?? '',
        dateISO: day.dateISO,
        beforeMinutes,
        afterMinutes
      });
    }
  }

  return rows;
}
