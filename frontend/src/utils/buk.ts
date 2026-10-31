import * as XLSX from 'xlsx';
import type { Employee, TimeSlot, WeekPlan } from '../types';
import { isOvertimeAssignment, isWorkAssignment } from './assignments';
import { isAnyRestDayForDate, isRestDayForDate } from './weekdays';

/**
 * Exportación a las plantillas de BUK (ver /Migrar_BUK):
 * - Creacion_Turnos_Template.xls: catálogo de turnos (un código único por horario,
 *   mismo horario repetido en los 7 días).
 * - Asignar_Turnos_Colaboradores.xls: código de turno por colaborador y fecha.
 */

export const BUK_DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

export const BUK_REST_CODE = 'D';

const BUK_SPECIAL_SHIFTS: Array<[string, string]> = [
  ['Descanso', 'D'],
  ['Feriado', 'F'],
  ['Licencia', 'L'],
  ['Permiso', 'P'],
  ['Vacación', 'V'],
  ['Compensado', 'C']
];

export type BukShift = {
  /** Prefijo de área + inicio-fin. Identifica el turno independiente del código. */
  signature: string;
  areaLabel: string;
  code: string;
  name: string;
  start: string;
  end: string;
  nocturnal: boolean;
  /** Empresas de los colaboradores que usan el turno: cada una sale con su recinto. */
  companyIds: string[];
  /** Recintos en los que ya se creó en BUK; null si el turno es nuevo. */
  registeredRecintoCodes: string[] | null;
};

/** Turno ya creado en BUK (registro del backend): su código y nombre no cambian. */
export type BukRegisteredShiftInfo = {
  signature: string;
  code: string;
  name: string;
  areaLabel: string;
  start: string;
  end: string;
  nocturnal: boolean;
  recintoCodes: string[];
};

export type BukEmployeeRow = {
  employeeId: string;
  employeeName: string;
  identifier: string;
  /** Firma del turno (BukShift.signature), descanso (D) o vacío por fecha. */
  cells: Record<string, { kind: 'shift'; signature: string } | { kind: 'rest' } | { kind: 'empty' }>;
  warnings: string[];
};

export type BukExportData = {
  dates: string[];
  shifts: BukShift[];
  rows: BukEmployeeRow[];
  /** Turnos usados en la semana de la asignación. */
  currentWeekSignatures: Set<string>;
};

type Interval = { start: number; end: number };

const DAY_MINUTES = 24 * 60;

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

function formatMinutes(total: number): string {
  const normalized = ((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** 12:00 → "12", 18:00 → "6", 10:30 → "1030" (estilo HSL12A10 / HSL6A10). */
function formatCodeHour(total: number): string {
  const normalized = ((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return minutes ? `${hours12}${String(minutes).padStart(2, '0')}` : String(hours12);
}

/** 12:00 → "12pm", 06:30 → "6:30am". */
function formatNameHour(total: number): string {
  const normalized = ((total % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const suffix = hours24 < 12 ? 'am' : 'pm';
  return minutes ? `${hours12}:${String(minutes).padStart(2, '0')}${suffix}` : `${hours12}${suffix}`;
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Salon → HSL, Oficina → HOF, Producción → HPR (primera letra + siguiente consonante). */
export function buildDefaultBukPrefix(areaLabel: string): string {
  const letters = stripAccents(areaLabel).toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return 'H';
  const first = letters[0];
  const nextConsonant = letters.slice(1).split('').find((char) => !'AEIOU'.includes(char)) ?? letters[1] ?? '';
  return `H${first}${nextConsonant}`;
}

/** BUK espera DD-MM-YYYY en las columnas de fechas de la asignación. */
export function formatBukDate(dateISO: string): string {
  const [year, month, day] = dateISO.split('-');
  return `${day}-${month}-${year}`;
}

function getWorkIntervals(employee: Employee, day: WeekPlan['days'][number], orderedSlots: TimeSlot[]): Interval[] {
  const intervals: Interval[] = [];
  for (const slot of orderedSlots) {
    const assignment = day.assignments[slot.id]?.[employee.id];
    // Las horas extra no forman parte del turno.
    if (!isWorkAssignment(assignment) || isOvertimeAssignment(assignment)) continue;
    const start = parseTimeToMinutes(slot.start);
    let end = parseTimeToMinutes(slot.end);
    if (start === null || end === null) continue;
    if (end <= start) end += DAY_MINUTES;
    const last = intervals[intervals.length - 1];
    if (last && last.end === start) {
      last.end = end;
    } else {
      intervals.push({ start, end });
    }
  }
  return intervals;
}

/** Empresa del colaborador, con la misma prioridad que usa la planificación. */
export function getBukCompanyId(employee: Employee): string {
  return employee.moduleCompanyId ?? employee.companyId ?? '';
}

/** Una semana planificada de un área. */
export type BukWeekSource = {
  areaLabel: string;
  employees: Employee[];
  timeSlots: TimeSlot[];
  weekPlan: WeekPlan;
};

type RawShift = Omit<BukShift, 'code' | 'name' | 'registeredRecintoCodes'>;

/** Calcula el turno diario de cada colaborador y registra los horarios en `shiftsByKey`. */
function analyzeWeek(source: BukWeekSource, shiftsByKey: Map<string, RawShift>): BukEmployeeRow[] {
  const { weekPlan, areaLabel } = source;
  const prefix = buildDefaultBukPrefix(areaLabel);
  const orderedSlots = [...source.timeSlots].sort((a, b) => a.order - b.order);
  const days = [...weekPlan.days].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const rows: BukEmployeeRow[] = [];

  for (const employee of source.employees) {
    if (!employee.active) continue;

    const companyId = getBukCompanyId(employee);
    const warnings: string[] = [];
    if (!employee.identityDocument?.trim()) warnings.push('Sin DNI.');
    if (!companyId) warnings.push('Sin empresa: sus turnos no tendrán recinto.');

    const intervalsByDay = days.map((day) => getWorkIntervals(employee, day, orderedSlots));

    // Turno que cruza medianoche: el bloque de las 00:00 del día siguiente
    // pertenece al turno del día anterior.
    for (let index = 0; index < intervalsByDay.length - 1; index += 1) {
      const current = intervalsByDay[index];
      const next = intervalsByDay[index + 1];
      const last = current[current.length - 1];
      if (last && last.end === DAY_MINUTES && next[0]?.start === 0) {
        last.end = DAY_MINUTES + next[0].end;
        next.shift();
      }
    }

    // Bloque de madrugada seguido de otro turno el mismo día: es el final de un
    // turno nocturno que empezó el día anterior (o la semana anterior).
    days.forEach((day, index) => {
      const intervals = intervalsByDay[index];
      if (intervals.length > 1 && intervals[0].start === 0) {
        intervals.shift();
        warnings.push(`${day.dayName}: el bloque desde las 00:00 se toma como fin del turno del día anterior.`);
      }
    });

    const cells: BukEmployeeRow['cells'] = {};
    days.forEach((day, index) => {
      const intervals = intervalsByDay[index];
      if (!intervals.length) {
        const overrideList = weekPlan.restDayOverrides?.[employee.id];
        const isRest =
          overrideList && overrideList.length > 0
            ? isAnyRestDayForDate(day.dateISO, overrideList)
            : isRestDayForDate(day.dateISO, employee.restDay);
        cells[day.dateISO] = isRest ? { kind: 'rest' } : { kind: 'empty' };
        return;
      }

      // El turno va de la primera a la última hora trabajada; BREAK y cortes no se
      // exportan (la colación en BUK va siempre como "-").
      const first = intervals[0];
      const last = intervals[intervals.length - 1];
      const start = formatMinutes(first.start);
      const end = formatMinutes(last.end);
      const signature = `${prefix}::${start}-${end}`;
      const existing = shiftsByKey.get(signature);
      if (!existing) {
        shiftsByKey.set(signature, {
          signature,
          areaLabel,
          start,
          end,
          // Fin a las 00:00 o después: en BUK la hora de fin queda menor que la de inicio.
          nocturnal: last.end >= DAY_MINUTES,
          companyIds: companyId ? [companyId] : []
        });
      } else if (companyId && !existing.companyIds.includes(companyId)) {
        existing.companyIds.push(companyId);
      }
      cells[day.dateISO] = { kind: 'shift', signature };
    });

    rows.push({
      employeeId: employee.id,
      employeeName: employee.name,
      identifier: employee.identityDocument?.trim() ?? '',
      cells,
      warnings
    });
  }

  return rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

function assignCodes(rawShifts: RawShift[], registered: BukRegisteredShiftInfo[]): BukShift[] {
  const registeredBySignature = new Map(registered.map((shift) => [shift.signature, shift]));
  // Los turnos ya creados en BUK conservan su código; los nuevos no pueden repetirlo.
  const usedCodes = new Set(registered.map((shift) => shift.code));
  const rawBySignature = new Map(rawShifts.map((shift) => [shift.signature, shift]));
  const registeredShifts: BukShift[] = registered.map((shift) => ({
    signature: shift.signature,
    areaLabel: shift.areaLabel,
    start: shift.start,
    end: shift.end,
    nocturnal: shift.nocturnal,
    companyIds: rawBySignature.get(shift.signature)?.companyIds ?? [],
    code: shift.code,
    name: shift.name,
    registeredRecintoCodes: shift.recintoCodes
  }));

  // En formato 12h "6A10" puede ser 6am o 6pm: los turnos que inician desde el
  // mediodía (salón, ej. HSL6A10 = 18:00-22:00) reciben primero el código limpio
  // y el resto, si colisiona, un sufijo numérico.
  const isAfternoonStart = (shift: RawShift): number => (shift.start >= '12:00' ? 0 : 1);
  const newShifts: BukShift[] = rawShifts
    .filter((shift) => !registeredBySignature.has(shift.signature))
    .sort((a, b) => isAfternoonStart(a) - isAfternoonStart(b) || a.signature.localeCompare(b.signature))
    .map((shift) => {
      const prefix = shift.signature.split('::')[0];
      const startMinutes = parseTimeToMinutes(shift.start) ?? 0;
      const endMinutes = parseTimeToMinutes(shift.end) ?? 0;

      const baseCode = `${prefix}${formatCodeHour(startMinutes)}A${formatCodeHour(endMinutes)}`;
      let code = baseCode;
      for (let suffix = 2; usedCodes.has(code); suffix += 1) code = `${baseCode}${suffix}`;
      usedCodes.add(code);

      const name = `Horario de ${shift.areaLabel} ${formatNameHour(startMinutes)} a ${formatNameHour(endMinutes)}`;

      return { ...shift, code, name, registeredRecintoCodes: null };
    });

  return [...registeredShifts, ...newShifts].sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * `shifts` es el catálogo completo (turnos ya creados en BUK + todas las semanas y áreas
 * de `allSources`); `rows`/`dates` son la asignación de `currentSource`.
 */
export function buildBukExportData(
  currentSource: BukWeekSource | undefined,
  allSources: BukWeekSource[],
  registered: BukRegisteredShiftInfo[]
): BukExportData {
  const shiftsByKey = new Map<string, RawShift>();
  for (const source of allSources) {
    if (source !== currentSource) analyzeWeek(source, shiftsByKey);
  }
  const rows = currentSource ? analyzeWeek(currentSource, shiftsByKey) : [];
  const dates = currentSource ? [...currentSource.weekPlan.days].map((day) => day.dateISO).sort() : [];
  const currentWeekSignatures = new Set(
    rows.flatMap((row) => Object.values(row.cells).flatMap((cell) => (cell.kind === 'shift' ? [cell.signature] : [])))
  );

  return { dates, shifts: assignCodes(Array.from(shiftsByKey.values()), registered), rows, currentWeekSignatures };
}

function buildWorkbook(sheets: Array<{ name: string; rows: string[][] }>): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    worksheet['!cols'] = (sheet.rows[0] ?? []).map((header) => ({ wch: Math.max(12, header.length + 2) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }
  return workbook;
}

export type BukRecintoInfo = { companyId: string; code: string; name: string; attendanceEnabled: boolean };

export type BukCreacionEntry = { shift: BukShift; recinto: BukRecintoInfo | null };

/** Filas de creación (turno × recinto). Sin `includeRegistered`, solo las que faltan crear en BUK. */
export function getBukCreacionEntries(
  shifts: BukShift[],
  recintos: BukRecintoInfo[],
  includeRegistered: boolean
): BukCreacionEntry[] {
  const recintoByCompanyId = new Map(recintos.map((recinto) => [recinto.companyId, recinto]));
  const recintoByCode = new Map(recintos.map((recinto) => [recinto.code, recinto]));
  return shifts.flatMap((shift) => {
    const registeredCodes = shift.registeredRecintoCodes ?? [];
    const shiftRecintos = [
      ...shift.companyIds.map((companyId) => recintoByCompanyId.get(companyId)),
      ...registeredCodes.map((code) => recintoByCode.get(code))
    ]
      .filter((recinto): recinto is BukRecintoInfo => recinto !== undefined)
      .filter((recinto, index, list) => list.findIndex((item) => item.code === recinto.code) === index);
    const targets: Array<BukRecintoInfo | null> = shiftRecintos.length ? shiftRecintos : [null];
    return targets
      .filter((recinto) =>
        includeRegistered || (recinto ? !registeredCodes.includes(recinto.code) : shift.registeredRecintoCodes === null)
      )
      .map((recinto) => ({ shift, recinto }));
  });
}

export function downloadBukCreacionTurnos(entries: BukCreacionEntry[], recintos: BukRecintoInfo[], fileName: string): void {
  const header = ['Nombre Recinto', 'Código Recinto', 'Nombre*', 'Código*', 'Turno Nocturno (Si/No)*'];
  for (const dayName of BUK_DAY_NAMES) {
    header.push(
      `${dayName} - Hora Inicio (HH:MM)`,
      `${dayName} - Hora Fin (HH:MM)`,
      `${dayName} - Inicio Colación (HH:MM)`,
      `${dayName} - Fin Colación (HH:MM)`
    );
  }

  const shiftRows = entries.map(({ shift, recinto }) => {
    const row = [recinto?.name ?? '', recinto?.code ?? '', shift.name, shift.code, shift.nocturnal ? 'Si' : 'No'];
    for (let index = 0; index < BUK_DAY_NAMES.length; index += 1) {
      row.push(shift.start, shift.end, '-', '-');
    }
    return row;
  });

  const recintoRows = [
    ['Código', 'Nombre', '¿Habilitado para asistencia?', 'Estado Configuración'],
    ...[...recintos]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((recinto) => [recinto.code, recinto.name, recinto.attendanceEnabled ? 'Sí' : 'No', 'Configurado'])
  ];

  const workbook = buildWorkbook([
    { name: 'Turnos', rows: [header, ...shiftRows] },
    { name: 'Recintos', rows: recintoRows }
  ]);
  XLSX.writeFile(workbook, fileName, { bookType: 'biff8' });
}

export function downloadBukAsignarTurnos(data: BukExportData, areaLabel: string, fileName: string): void {
  const codeBySignature = new Map(data.shifts.map((shift) => [shift.signature, shift.code]));

  const assignmentHeader = ['Nombre del Colaborador', 'RUT', 'Área', 'Supervisor', ...data.dates.map(formatBukDate)];
  const assignmentRows = data.rows.map((row) => [
    row.employeeName.toUpperCase(),
    row.identifier,
    areaLabel.toUpperCase(),
    '',
    ...data.dates.map((dateISO) => {
      const cell = row.cells[dateISO];
      if (!cell || cell.kind === 'empty') return '';
      if (cell.kind === 'rest') return BUK_REST_CODE;
      return codeBySignature.get(cell.signature) ?? '';
    })
  ]);

  const specialRows = BUK_SPECIAL_SHIFTS.map(([name, code]) => [name, code, '', '-', '-', '-', '-']);
  const weeklyRows = data.shifts.flatMap((shift) =>
    BUK_DAY_NAMES.map((dayName) => [shift.name, shift.code, dayName, shift.start, shift.end, '-', '-'])
  );

  const workbook = buildWorkbook([
    { name: 'turnosColaboradores', rows: [assignmentHeader, ...assignmentRows] },
    {
      name: 'turnosSemanales',
      rows: [
        ['Nombre del turno', 'Siglas', 'Nombre del día', 'Entrada del turno', 'Salida del turno', 'Entrada de colación', 'Salida de colación'],
        ...specialRows,
        ...weeklyRows
      ]
    },
    {
      name: 'turnosFlexibles',
      rows: [
        ['Nombre del turno', 'Sigla', 'Nombre del día', 'Numero de horas', 'Entrada de colación', 'Salida de colación'],
        ...BUK_SPECIAL_SHIFTS.map(([name, code]) => [name, code, '', '-', '-', '-'])
      ]
    },
    {
      name: 'turnosTransitorios',
      rows: [
        ['Nombre del turno', 'Siglas', 'Fecha Jornada', 'Entrada del turno', 'Salida del turno', 'Entrada de colación', 'Salida de colación'],
        ...specialRows
      ]
    }
  ]);
  XLSX.writeFile(workbook, fileName, { bookType: 'biff8' });
}
