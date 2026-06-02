import { jsPDF } from 'jspdf';
import type { BreakConfig, DayPlan, Employee, Role, TimeSlot, Week, WeekPlan } from '../types';
import { isTimeSlotInBreak } from './breaks';
import { isBreakAssignment, isOvertimeAssignment, isWorkAssignment } from './assignments';
import { isAnyRestDayForDate, isRestDayForDate } from './weekdays';

/**
 * Nombre corto para encabezados del PDF: inicial del nombre + primer apellido (paterno).
 * lastName guarda "paterno materno" en una sola propiedad, por eso se toma hasta el primer espacio.
 */
function shortEmployeeName(employee: Employee): string {
  const firstSource = (employee.firstName?.trim() || employee.name?.trim() || '').split(/\s+/)[0] ?? '';
  const initial = firstSource ? `${firstSource.charAt(0).toUpperCase()}.` : '';
  const lastSource = employee.lastName?.trim() ?? '';
  const paterno = lastSource
    ? lastSource.split(/\s+/)[0]
    : (employee.name?.trim().split(/\s+/).slice(-1)[0] ?? '');
  const short = [initial, paterno].filter(Boolean).join(' ');
  return short || employee.name || '';
}

function isEmployeeRestForDate(
  dateISO: string,
  employee: Employee,
  overridesById?: Record<string, number[]>
): boolean {
  const override = overridesById?.[employee.id];
  if (override && override.length > 0) return isAnyRestDayForDate(dateISO, override);
  return isRestDayForDate(dateISO, employee.restDay);
}

type DownloadEmployeeWeekPdfInput = {
  employee: Employee;
  roles: Role[];
  timeSlots: TimeSlot[];
  breakConfig: BreakConfig;
  week: Week;
  weekPlan: WeekPlan;
  isValidated: boolean;
  validatedByName: string | null;
};

type DownloadWeeklyOverviewPdfInput = {
  employees: Employee[];
  roles: Role[];
  timeSlots: TimeSlot[];
  breakConfig: BreakConfig;
  week: Week;
  weekPlan: WeekPlan;
  isValidated: boolean;
  validatedByName: string | null;
};

type DownloadWeeklyGridPdfInput = {
  employees: Employee[];
  roles: Role[];
  timeSlots: TimeSlot[];
  breakConfig: BreakConfig;
  week: Week;
  weekPlan: WeekPlan;
  isValidated: boolean;
  validatedByName: string | null;
};

type DownloadDaySchedulePdfInput = {
  dayPlan: DayPlan;
  employees: Employee[];
  roles: Role[];
  timeSlots: TimeSlot[];
  breakConfig: BreakConfig;
  week: Week;
  isValidated: boolean;
  validatedByName: string | null;
  restDayOverrides?: Record<string, number[]>;
};

export function downloadEmployeeWeekPdf({
  employee,
  roles,
  timeSlots,
  breakConfig,
  week,
  weekPlan,
  isValidated,
  validatedByName
}: DownloadEmployeeWeekPdfInput): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  drawEmployeeSchedulePage(doc, {
    employee,
    roles,
    timeSlots,
    breakConfig,
    week,
    weekPlan,
    includeSummary: false,
    isValidated,
    validatedByName
  });

  const safeWeek = week.label.replace(/[^\w-]+/g, '-');
  const safeEmployee = employee.name.replace(/[^\w-]+/g, '-').toLowerCase();
  doc.save(`horario-${safeEmployee}-${safeWeek}.pdf`);
}

export function downloadWeeklyOverviewPdf({
  employees,
  roles,
  timeSlots,
  breakConfig,
  week,
  weekPlan,
  isValidated,
  validatedByName
}: DownloadWeeklyOverviewPdfInput): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const activeEmployees = employees.filter((employee) => employee.active);

  activeEmployees.forEach((employee, index) => {
    if (index > 0) doc.addPage();
    drawEmployeeSchedulePage(doc, {
      employee,
      roles,
      timeSlots,
      breakConfig,
      week,
      weekPlan,
      includeSummary: true,
      isValidated,
      validatedByName
    });
  });

  const safeWeek = week.label.replace(/[^\w-]+/g, '-');
  doc.save(`vista-general-${safeWeek}.pdf`);
}

export function downloadDaySchedulePdf({
  dayPlan,
  employees,
  roles,
  timeSlots,
  breakConfig,
  week,
  isValidated,
  validatedByName,
  restDayOverrides
}: DownloadDaySchedulePdfInput): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  drawDaySchedulePage(doc, { dayPlan, employees, roles, timeSlots, breakConfig, week, isValidated, validatedByName, restDayOverrides });

  const safeDay = `${dayPlan.dayName}-${dayPlan.dateISO}`.replace(/[^\w-]+/g, '-').toLowerCase();
  doc.save(`horario-dia-${safeDay}.pdf`);
}

export function downloadWeeklyGridPdf({
  employees,
  roles,
  timeSlots,
  breakConfig,
  week,
  weekPlan,
  isValidated,
  validatedByName
}: DownloadWeeklyGridPdfInput): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  drawWeeklyGridSinglePage(doc, {
    dayPlans: weekPlan.days,
    employees,
    roles,
    timeSlots,
    breakConfig,
    week,
    isValidated,
    validatedByName,
    restDayOverrides: weekPlan.restDayOverrides
  });

  const safeWeek = week.label.replace(/[^\w-]+/g, '-');
  doc.save(`vista-grid-${safeWeek}.pdf`);
}

function drawWeeklyGridSinglePage(
  doc: jsPDF,
  input: {
    dayPlans: DayPlan[];
    employees: Employee[];
    roles: Role[];
    timeSlots: TimeSlot[];
    breakConfig: BreakConfig;
    week: Week;
    isValidated: boolean;
    validatedByName: string | null;
    restDayOverrides?: Record<string, number[]>;
  }
): void {
  const { dayPlans, employees, roles, timeSlots, breakConfig, week, isValidated, validatedByName, restDayOverrides } = input;
  const roleColorById = new Map(roles.map((role) => [role.id, role.colorHex]));
  const activeEmployees = employees.filter((employee) => employee.active);
  const visibleTimeSlots = getVisibleTimeSlots(timeSlots);

  const marginX = 8;
  const marginTop = 7;
  const rowHeight = 3.9;
  const headerHeight = 4.6;
  const sectionTitleGap = 3.2;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  // El encabezado real se dibuja con altura Math.max(headerHeight, 8); usar ese valor evita que
  // la siguiente fila de tablas (y sus títulos de fecha) se superponga con la fila de arriba.
  const wrappedHeaderHeight = Math.max(headerHeight, 8);
  const tableBodyHeight = sectionTitleGap + wrappedHeaderHeight + visibleTimeSlots.length * rowHeight;
  const topRowHeight = tableBodyHeight;
  const blockGap = 6;
  const thirdWidth = (contentWidth - blockGap * 2) / 3;

  let y = marginTop;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Planificacion de Horarios', marginX, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Semana: ${week.label}`, marginX, y);
  y += 3.2;
  const validationBottomY = drawValidationInfo(doc, marginX, y, isValidated, validatedByName, 7, 3);
  const topY = validationBottomY + 6;
  const bottomY = topY + topRowHeight + blockGap;

  const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = dayPlans;

  if (monday) {
    drawCompactDayTable(doc, monday, marginX, topY, thirdWidth, activeEmployees, visibleTimeSlots, breakConfig, roleColorById, rowHeight, headerHeight, sectionTitleGap, restDayOverrides);
  }
  if (tuesday) {
    drawCompactDayTable(doc, tuesday, marginX + thirdWidth + blockGap, topY, thirdWidth, activeEmployees, visibleTimeSlots, breakConfig, roleColorById, rowHeight, headerHeight, sectionTitleGap, restDayOverrides);
  }
  if (wednesday) {
    drawCompactDayTable(doc, wednesday, marginX + (thirdWidth + blockGap) * 2, topY, thirdWidth, activeEmployees, visibleTimeSlots, breakConfig, roleColorById, rowHeight, headerHeight, sectionTitleGap, restDayOverrides);
  }
  if (thursday) {
    drawCompactDayTable(doc, thursday, marginX, bottomY, thirdWidth, activeEmployees, visibleTimeSlots, breakConfig, roleColorById, rowHeight, headerHeight, sectionTitleGap, restDayOverrides);
  }
  if (friday) {
    drawCompactDayTable(doc, friday, marginX + thirdWidth + blockGap, bottomY, thirdWidth, activeEmployees, visibleTimeSlots, breakConfig, roleColorById, rowHeight, headerHeight, sectionTitleGap, restDayOverrides);
  }
  if (saturday) {
    drawCompactDayTable(doc, saturday, marginX + (thirdWidth + blockGap) * 2, bottomY, thirdWidth, activeEmployees, visibleTimeSlots, breakConfig, roleColorById, rowHeight, headerHeight, sectionTitleGap, restDayOverrides);
  }
  if (sunday) {
    const sundayY = Math.min(bottomY + topRowHeight + blockGap, pageHeight - tableBodyHeight - 8);
    drawCompactDayTable(doc, sunday, marginX, sundayY, thirdWidth, activeEmployees, visibleTimeSlots, breakConfig, roleColorById, rowHeight, headerHeight, sectionTitleGap, restDayOverrides);
    drawLegendBottom(doc, roles, marginX + thirdWidth + blockGap + 2, sundayY + 2, thirdWidth * 2 - 2, 7);
  } else {
    drawLegendBottom(doc, roles, marginX, bottomY + topRowHeight + 6, contentWidth, 7);
  }
}

function drawCompactDayTable(
  doc: jsPDF,
  dayPlan: DayPlan,
  startX: number,
  startY: number,
  tableWidth: number,
  activeEmployees: Employee[],
  visibleTimeSlots: TimeSlot[],
  breakConfig: BreakConfig,
  roleColorById: Map<string, string>,
  rowHeight: number,
  headerHeight: number,
  sectionTitleGap: number,
  restDayOverrides?: Record<string, number[]>
): void {
  const firstColumnWidth = Math.min(18, tableWidth * 0.22);
  const employeeColumnWidth = (tableWidth - firstColumnWidth) / Math.max(activeEmployees.length, 1);
  const columnWidths = [firstColumnWidth, ...activeEmployees.map(() => employeeColumnWidth)];
  const wrappedHeaderHeight = Math.max(headerHeight, 8);

  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(`${dayPlan.dayName} (${dayPlan.dateISO})`, startX, y);
  y += sectionTitleGap;

  const headerCells = ['Horario', ...activeEmployees.map((employee) => shortEmployeeName(employee))];
  drawRow(doc, startX, y, headerCells, columnWidths, wrappedHeaderHeight, true, undefined, 5.8, 0.9, true);
  y += wrappedHeaderHeight;

  for (const slot of visibleTimeSlots) {
    const rowValues = [slot.label];
    const fillColors: Array<[number, number, number] | null> = [null];
    for (const employee of activeEmployees) {
      const assignment = dayPlan.assignments[slot.id]?.[employee.id];
      const isBreak = isBreakAssignment(assignment);
      const isWork = isWorkAssignment(assignment);
      const label = !assignment
        ? isEmployeeRestForDate(dayPlan.dateISO, employee, restDayOverrides)
          ? 'Descanso'
          : isTimeSlotInBreak(slot, breakConfig)
            ? 'Break'
            : 'SIN ASIGNAR'
        : isBreak
          ? 'Break'
          : !isWork
            ? isEmployeeRestForDate(dayPlan.dateISO, employee, restDayOverrides)
              ? 'Descanso'
              : isTimeSlotInBreak(slot, breakConfig)
                ? 'Break'
                : 'SIN ASIGNAR'
            : isOvertimeAssignment(assignment)
              ? 'HE'
              : assignment.code;
      rowValues.push(label);
      if (isBreak) {
        fillColors.push([255, 244, 220]);
      } else if (!isWork) {
        fillColors.push([255, 255, 255]);
      } else if (isOvertimeAssignment(assignment)) {
        fillColors.push([237, 231, 246]);
      } else {
        fillColors.push(tintRoleCellColor(roleColorById.get(assignment.roleId)));
      }
    }
    drawRow(doc, startX, y, rowValues, columnWidths, rowHeight, false, fillColors, 5.3, 0.9);
    y += rowHeight;
  }
}

function drawDaySchedulePage(
  doc: jsPDF,
  input: {
    dayPlan: DayPlan;
    employees: Employee[];
    roles: Role[];
    timeSlots: TimeSlot[];
    breakConfig: BreakConfig;
    week: Week;
    isValidated: boolean;
    validatedByName: string | null;
    restDayOverrides?: Record<string, number[]>;
  }
): void {
  const { dayPlan, employees, roles, timeSlots, breakConfig, week, isValidated, validatedByName, restDayOverrides } = input;
  const roleColorById = new Map(roles.map((role) => [role.id, role.colorHex]));
  const activeEmployees = employees.filter((employee) => employee.active);
  const visibleTimeSlots = getVisibleTimeSlots(timeSlots);

  const marginX = 8;
  const marginTop = 10;
  const rowHeight = 7;
  const headerHeight = 10;
  const firstColumnWidth = 30;
  const pageWidth = doc.internal.pageSize.getWidth();
  const employeeColumnWidth = (pageWidth - marginX * 2 - firstColumnWidth) / Math.max(activeEmployees.length, 1);
  const columnWidths = [firstColumnWidth, ...activeEmployees.map(() => employeeColumnWidth)];

  let y = marginTop;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Planificacion de Horarios', marginX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Semana: ${week.label}`, marginX, y);
  y += 5;
  doc.text(`Dia: ${dayPlan.dayName} (${dayPlan.dateISO})`, marginX, y);
  y += 5;
  y = drawValidationInfo(doc, marginX, y, isValidated, validatedByName);
  y += 2;

  const headerCells = ['Horario', ...activeEmployees.map((employee) => shortEmployeeName(employee))];
  drawRow(doc, marginX, y, headerCells, columnWidths, headerHeight, true, undefined, 6.2, 1.2, true);
  y += headerHeight;

  for (const slot of visibleTimeSlots) {
    const rowValues = [slot.label];
    const fillColors: Array<[number, number, number] | null> = [null];
    for (const employee of activeEmployees) {
      const assignment = dayPlan.assignments[slot.id]?.[employee.id];
      const isBreak = isBreakAssignment(assignment);
      const isWork = isWorkAssignment(assignment);
      const label = !assignment
        ? isEmployeeRestForDate(dayPlan.dateISO, employee, restDayOverrides)
          ? 'Descanso'
          : isTimeSlotInBreak(slot, breakConfig)
            ? 'Break'
            : 'SIN ASIGNAR'
        : isBreak
          ? 'Break'
          : !isWork
            ? isEmployeeRestForDate(dayPlan.dateISO, employee, restDayOverrides)
              ? 'Descanso'
              : isTimeSlotInBreak(slot, breakConfig)
                ? 'Break'
                : 'SIN ASIGNAR'
            : isOvertimeAssignment(assignment)
              ? 'HE'
              : assignment.code;
      rowValues.push(label);
      if (isBreak) {
        fillColors.push([255, 244, 220]);
      } else if (!isWork) {
        fillColors.push([255, 255, 255]);
      } else if (isOvertimeAssignment(assignment)) {
        fillColors.push([237, 231, 246]);
      } else {
        fillColors.push(tintRoleCellColor(roleColorById.get(assignment.roleId)));
      }
    }
    drawRow(doc, marginX, y, rowValues, columnWidths, rowHeight, false, fillColors);
    y += rowHeight;
  }
  drawLegendBottom(doc, roles, marginX, y + 6, pageWidth - marginX * 2);
}

function drawEmployeeSchedulePage(
  doc: jsPDF,
  input: {
    employee: Employee;
    roles: Role[];
    timeSlots: TimeSlot[];
    breakConfig: BreakConfig;
    week: Week;
    weekPlan: WeekPlan;
    includeSummary: boolean;
    isValidated: boolean;
    validatedByName: string | null;
  }
): void {
  const { employee, roles, timeSlots, breakConfig, week, weekPlan, includeSummary, isValidated, validatedByName } = input;
  const roleById = new Map(roles.map((role) => [role.id, role.name]));
  const roleColorById = new Map(roles.map((role) => [role.id, role.colorHex]));
  const visibleTimeSlots = getVisibleTimeSlots(timeSlots);

  const marginX = 8;
  const marginTop = 10;
  const rowHeight = 7;
  const firstColumnWidth = 30;
  const pageWidth = doc.internal.pageSize.getWidth();
  const days = weekPlan.days;
  const dayColumnWidth = (pageWidth - marginX * 2 - firstColumnWidth) / Math.max(days.length, 1);
  const columnWidths = [firstColumnWidth, ...days.map(() => dayColumnWidth)];

  let y = marginTop;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Planificacion de Horarios', marginX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Semana: ${week.label}`, marginX, y);
  y += 5;
  doc.text(`Colaborador: ${employee.name}`, marginX, y);
  const mainRole = employee.mainRoleId ? roleById.get(employee.mainRoleId) ?? '-' : '-';
  doc.text(`Rol principal: ${mainRole}`, marginX + 95, y);
  y += 5;
  doc.text(`Estado: ${employee.active ? 'Activo' : 'Inactivo'}`, marginX, y);
  if (includeSummary) {
    const assignedHours = computeAssignedHours(employee.id, days, visibleTimeSlots);
    const targetHours = employee.weeklyHours ?? 0;
    doc.text(`Horas: ${assignedHours.toFixed(1)}h / ${targetHours.toFixed(1)}h`, marginX + 95, y);
  }
  y += 5;
  y = drawValidationInfo(doc, marginX, y, isValidated, validatedByName);
  y += 2;

  const headerCells = ['Horario', ...days.map((day) => day.dayName)];
  drawRow(doc, marginX, y, headerCells, columnWidths, rowHeight, true);
  y += rowHeight;

  for (const slot of visibleTimeSlots) {
    const rowValues = [slot.label];
    const fillColors: Array<[number, number, number] | null> = [null];
    for (const day of days) {
      const assignment = day.assignments[slot.id]?.[employee.id];
      const isBreak = isBreakAssignment(assignment);
      const isWork = isWorkAssignment(assignment);
      const overrideMap = weekPlan.restDayOverrides;
      const label = !assignment
        ? isEmployeeRestForDate(day.dateISO, employee, overrideMap)
          ? 'Descanso'
          : isTimeSlotInBreak(slot, breakConfig)
            ? 'Break'
            : 'SIN ASIGNAR'
        : isBreak
          ? 'Break'
          : !isWork
            ? isEmployeeRestForDate(day.dateISO, employee, overrideMap)
              ? 'Descanso'
              : isTimeSlotInBreak(slot, breakConfig)
                ? 'Break'
                : 'SIN ASIGNAR'
            : isOvertimeAssignment(assignment)
              ? 'HE'
              : assignment.code;
      rowValues.push(label);
      if (isBreak) {
        fillColors.push([255, 244, 220]);
      } else if (!isWork) {
        fillColors.push([255, 255, 255]);
      } else if (isOvertimeAssignment(assignment)) {
        fillColors.push([237, 231, 246]);
      } else {
        fillColors.push(tintRoleCellColor(roleColorById.get(assignment.roleId)));
      }
    }
    drawRow(doc, marginX, y, rowValues, columnWidths, rowHeight, false, fillColors);
    y += rowHeight;
  }
  drawLegendBottom(doc, roles, marginX, y + 6, pageWidth - marginX * 2);
}

function drawRow(
  doc: jsPDF,
  startX: number,
  y: number,
  cells: string[],
  columnWidths: number[],
  rowHeight: number,
  isHeader: boolean,
  fillColors?: Array<[number, number, number] | null>,
  fontSize = 9,
  textOffsetY = 1.2,
  wrapText = false
): void {
  let x = startX;
  doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  for (let index = 0; index < cells.length; index += 1) {
    const width = columnWidths[index] ?? columnWidths[columnWidths.length - 1];
    const fill = fillColors?.[index] ?? null;
    if (isHeader) {
      doc.setFillColor(232, 236, 242);
      doc.rect(x, y, width, rowHeight, 'F');
    } else if (fill) {
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.rect(x, y, width, rowHeight, 'F');
    }
    doc.rect(x, y, width, rowHeight);
    if (wrapText) {
      const lines = doc.splitTextToSize(cells[index] ?? '', width - 3) as string[];
      const lineHeight = fontSize * 0.35;
      const totalTextHeight = Math.max(lines.length, 1) * lineHeight;
      const startY = y + Math.max(1.2, (rowHeight - totalTextHeight) / 2 + lineHeight);
      doc.text(lines, x + 1.5, startY, { maxWidth: width - 3 });
    } else {
      doc.text(cells[index] ?? '', x + 1.5, y + rowHeight / 2 + textOffsetY, { maxWidth: width - 3 });
    }
    x += width;
  }
}

function hexToRgb(value?: string): [number, number, number] | null {
  if (!value) return null;
  const normalized = value.replace('#', '').trim();
  if (!/^[\da-fA-F]{6}$/.test(normalized)) return null;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function tintRoleCellColor(roleHex?: string): [number, number, number] {
  const base = hexToRgb(roleHex) ?? hexToRgb('#EDF2F7') ?? [237, 242, 247];
  const alpha = 0x33 / 255;
  const blend = (channel: number) => Math.round((1 - alpha) * 255 + alpha * channel);
  return [blend(base[0]), blend(base[1]), blend(base[2])];
}

function getVisibleTimeSlots(timeSlots: TimeSlot[]): TimeSlot[] {
  return [...timeSlots].sort((a, b) => a.order - b.order);
}

function drawValidationInfo(
  doc: jsPDF,
  startX: number,
  y: number,
  isValidated: boolean,
  validatedByName: string | null,
  fontSize = 10,
  lineGap = 4
): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.text(`Estado: ${isValidated ? 'VALIDADO' : 'NO VALIDADO'}`, startX, y);
  y += lineGap;
  const validatorName = isValidated && validatedByName ? validatedByName : 'Ninguno';
  doc.text(`Validador Por: ${validatorName}`, startX, y, { maxWidth: 180 });
  return y;
}

function drawLegendBottom(doc: jsPDF, roles: Role[], startX: number, startY: number, maxWidth: number, fontSize = 9): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.text('Leyenda de zonas:', startX, startY);

  let x = startX;
  let y = startY + 5;
  const endX = startX + maxWidth;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);

  for (const role of roles) {
    const color = hexToRgb(role.colorHex) ?? [237, 242, 247];
    const labelWidth = doc.getTextWidth(role.name);
    const itemWidth = 5 + labelWidth + 6;
    if (x + itemWidth > endX) {
      x = startX;
      y += 5;
    }
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x, y - 2.8, 3.5, 3.5, 'F');
    doc.rect(x, y - 2.8, 3.5, 3.5);
    doc.text(role.name, x + 5, y);
    x += itemWidth;
  }

  // Hora extra
  const heLabel = 'HE = Hora Extra';
  const heItemWidth = 5 + doc.getTextWidth(heLabel) + 6;
  if (x + heItemWidth > endX) {
    x = startX;
    y += 5;
  }
  doc.setFillColor(237, 231, 246);
  doc.rect(x, y - 2.8, 3.5, 3.5, 'F');
  doc.rect(x, y - 2.8, 3.5, 3.5);
  doc.text(heLabel, x + 5, y);
}

function computeAssignedHours(employeeId: string, days: WeekPlan['days'], slots: TimeSlot[]): number {
  const durationBySlotId = new Map(slots.map((slot) => [slot.id, getDurationHours(slot.start, slot.end)]));
  let assigned = 0;

  for (const day of days) {
    for (const slot of slots) {
      const assignment = day.assignments[slot.id]?.[employeeId];
      if (!isWorkAssignment(assignment)) continue;
      assigned += durationBySlotId.get(slot.id) ?? 0;
    }
  }

  return assigned;
}

function getDurationHours(start: string, end: string): number {
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
