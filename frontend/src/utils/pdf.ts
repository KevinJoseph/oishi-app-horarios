import { jsPDF } from 'jspdf';
import type { Employee, Role, TimeSlot, Week, WeekPlan } from '../types';

type DownloadEmployeeWeekPdfInput = {
  employee: Employee;
  roles: Role[];
  timeSlots: TimeSlot[];
  week: Week;
  weekPlan: WeekPlan;
};

export function downloadEmployeeWeekPdf({
  employee,
  roles,
  timeSlots,
  week,
  weekPlan
}: DownloadEmployeeWeekPdfInput): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const roleById = new Map(roles.map((role) => [role.id, role.name]));

  const marginX = 8;
  const marginTop = 10;
  const rowHeight = 7;
  const firstColumnWidth = 30;
  const pageWidth = doc.internal.pageSize.getWidth();
  const days = weekPlan.days;
  const dayColumnWidth = (pageWidth - marginX * 2 - firstColumnWidth) / Math.max(days.length, 1);
  const columnWidths = [firstColumnWidth, ...days.map(() => dayColumnWidth)];
  const roleColorById = new Map(roles.map((role) => [role.id, role.colorHex]));

  let y = marginTop;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Planificacion de Horarios', marginX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Semana: ${week.label}`, marginX, y);
  y += 5;
  doc.text(`Empleado: ${employee.name}`, marginX, y);
  const mainRole = employee.mainRoleId ? roleById.get(employee.mainRoleId) ?? '-' : '-';
  doc.text(`Rol principal: ${mainRole}`, marginX + 95, y);
  y += 5;
  doc.text(`Estado: ${employee.active ? 'Activo' : 'Inactivo'}`, marginX, y);
  y += 6;

  const headerCells = ['Horario', ...days.map((day) => day.dayName)];
  drawRow(doc, marginX, y, headerCells, columnWidths, rowHeight, true);
  y += rowHeight;

  for (const slot of timeSlots) {
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

  const safeWeek = week.label.replace(/[^\w-]+/g, '-');
  const safeEmployee = employee.name.replace(/[^\w-]+/g, '-').toLowerCase();
  doc.save(`horario-${safeEmployee}-${safeWeek}.pdf`);
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
