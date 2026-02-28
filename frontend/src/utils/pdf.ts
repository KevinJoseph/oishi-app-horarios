import { jsPDF } from 'jspdf';
import type { DayPlan, Employee, Role, TimeSlot, Week, WeekPlan } from '../types';

type DownloadEmployeeWeekPdfInput = {
  employee: Employee;
  roles: Role[];
  timeSlots: TimeSlot[];
  week: Week;
  weekPlan: WeekPlan;
  isValidated: boolean;
  validatedByName: string | null;
};

type DownloadWeeklyOverviewPdfInput = {
  employees: Employee[];
  roles: Role[];
  timeSlots: TimeSlot[];
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
  week: Week;
  isValidated: boolean;
  validatedByName: string | null;
};

export function downloadEmployeeWeekPdf({
  employee,
  roles,
  timeSlots,
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
  week,
  isValidated,
  validatedByName
}: DownloadDaySchedulePdfInput): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const roleColorById = new Map(roles.map((role) => [role.id, role.colorHex]));
  const activeEmployees = employees.filter((employee) => employee.active);
  const visibleTimeSlots = getVisibleTimeSlots(timeSlots);

  const marginX = 8;
  const marginTop = 10;
  const rowHeight = 7;
  const firstColumnWidth = 30;
  const pageWidth = doc.internal.pageSize.getWidth();
  const employeeColumnWidth = (pageWidth - marginX * 2 - firstColumnWidth) / Math.max(activeEmployees.length, 1);
  const columnWidths = [firstColumnWidth, ...activeEmployees.map(() => employeeColumnWidth)];

  let y = marginTop;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Planificacion Diaria', marginX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Semana: ${week.label}`, marginX, y);
  y += 5;
  doc.text(`Dia: ${dayPlan.dayName} (${dayPlan.dateISO})`, marginX, y);
  y += 5;
  y = drawValidationInfo(doc, marginX, y, isValidated, validatedByName);
  y += 2;

  const headerCells = ['Horario', ...activeEmployees.map((employee) => employee.name)];
  drawRow(doc, marginX, y, headerCells, columnWidths, rowHeight, true);
  y += rowHeight;

  for (const slot of visibleTimeSlots) {
    const rowValues = [slot.label];
    const fillColors: Array<[number, number, number] | null> = [null];
    for (const employee of activeEmployees) {
      const assignment = dayPlan.assignments[slot.id]?.[employee.id];
      rowValues.push(assignment?.code ?? 'LIBRE');
      if (!assignment || assignment.roleId === null || assignment.code === 'LIBRE') {
        fillColors.push([255, 255, 255]);
      } else {
        fillColors.push(tintRoleCellColor(roleColorById.get(assignment.roleId)));
      }
    }
    drawRow(doc, marginX, y, rowValues, columnWidths, rowHeight, false, fillColors);
    y += rowHeight;
  }
  drawLegendBottom(doc, roles, marginX, y + 6, pageWidth - marginX * 2);

  const safeDay = `${dayPlan.dayName}-${dayPlan.dateISO}`.replace(/[^\w-]+/g, '-').toLowerCase();
  doc.save(`horario-dia-${safeDay}.pdf`);
}

function drawEmployeeSchedulePage(
  doc: jsPDF,
  input: {
    employee: Employee;
    roles: Role[];
    timeSlots: TimeSlot[];
    week: Week;
    weekPlan: WeekPlan;
    includeSummary: boolean;
    isValidated: boolean;
    validatedByName: string | null;
  }
): void {
  const { employee, roles, timeSlots, week, weekPlan, includeSummary, isValidated, validatedByName } = input;
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
      rowValues.push(assignment?.code ?? 'LIBRE');
      if (!assignment || assignment.roleId === null || assignment.code === 'LIBRE') {
        fillColors.push([255, 255, 255]);
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
  fillColors?: Array<[number, number, number] | null>
): void {
  let x = startX;
  doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
  doc.setFontSize(9);
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
    doc.text(cells[index] ?? '', x + 2, y + rowHeight / 2 + 1.2, { maxWidth: width - 4 });
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
  validatedByName: string | null
): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Estado: ${isValidated ? 'VALIDADO' : 'NO VALIDADO'}`, startX, y);
  y += 4;
  const validatorName = isValidated && validatedByName ? validatedByName : 'Ninguno';
  doc.text(`Validador Por: ${validatorName}`, startX, y, { maxWidth: 180 });
  return y;
}

function drawLegendBottom(doc: jsPDF, roles: Role[], startX: number, startY: number, maxWidth: number): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Leyenda de zonas:', startX, startY);

  let x = startX;
  let y = startY + 5;
  const endX = startX + maxWidth;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

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
}

function computeAssignedHours(employeeId: string, days: WeekPlan['days'], slots: TimeSlot[]): number {
  const durationBySlotId = new Map(slots.map((slot) => [slot.id, getDurationHours(slot.start, slot.end)]));
  let assigned = 0;

  for (const day of days) {
    for (const slot of slots) {
      const assignment = day.assignments[slot.id]?.[employeeId];
      if (!assignment || assignment.roleId === null || assignment.code === 'LIBRE') continue;
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
