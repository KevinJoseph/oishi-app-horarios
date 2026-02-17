import { addWeeks, formatISO, parseISO } from 'date-fns';
import type { Employee, Role, TimeSlot, Week, WeekPlan } from '../types';
import { buildWeekLabel, formatDayNameEs, getCurrentMonday } from '../utils/dates';

export const mockRoles: Role[] = [
  { id: 'role-corredor', name: 'Corredor', colorHex: '#c70a0a', validCodes: ['CO01'] },
  { id: 'role-despacho', name: 'Despacho', colorHex: '#68D391', validCodes: ['DE01'] },
  { id: 'role-bienvenida', name: 'Bienvenida', colorHex: '#63B3ED', validCodes: ['BIE01'] },
  { id: 'role-salon01', name: 'Salon Zona 1', colorHex: '#F6AD55', validCodes: ['SA01'] },
  { id: 'role-salon02', name: 'Salon Zona 2', colorHex: '#68D391', validCodes: ['SA02'] },
  { id: 'role-caja', name: 'Caja', colorHex: '#63B3ED', validCodes: ['CAJ01'] }
];

export const mockEmployees: Employee[] = [
  {
    id: 'emp-1',
    name: 'Ana Pérez',
    active: true,
    weeklyHours: 56,
    contractType: 'full-time',
    shiftType: 'day',
    mainRoleId: 'role-caja',
    phone: '555-1001',
    restDay: 0
  },
  {
    id: 'emp-2',
    name: 'Luis Gómez',
    active: true,
    weeklyHours: 56,
    contractType: 'full-time',
    shiftType: 'day',
    mainRoleId: 'role-role-corredor',
    phone: '555-1002',
    restDay: 0
  },
  {
    id: 'emp-3',
    name: 'Marta Ruiz',
    active: true,
    weeklyHours: 56,
    contractType: 'full-time',
    shiftType: 'day',
    mainRoleId: 'role-corredor',
    phone: '555-1003',
    restDay: 0
  },
  {
    id: 'emp-4',
    name: 'Diego León',
    active: true,
    weeklyHours: 56,
    contractType: 'full-time',
    shiftType: 'day',
    mainRoleId: 'role-salon01',
    phone: '555-1004',
    restDay: 0
  },
  {
    id: 'emp-5',
    name: 'Carla Díaz',
    active: true,
    weeklyHours: 56,
    contractType: 'full-time',
    shiftType: 'day',
    mainRoleId: 'role-salon01',
    phone: '555-1005',
    restDay: 0
  }
];

export const mockTimeSlots: TimeSlot[] = [
  { id: 'ts-1', label: '11:00 - 12:00', start: '11:00', end: '12:00', order: 1 },
  { id: 'ts-2', label: '12:00 - 13:00', start: '12:00', end: '13:00', order: 2 },
  { id: 'ts-3', label: '13:00 - 14:00', start: '13:00', end: '14:00', order: 3 },
  { id: 'ts-4', label: '14:00 - 15:00', start: '14:00', end: '15:00', order: 4 },
  { id: 'ts-5', label: '15:00 - 16:00', start: '15:00', end: '16:00', order: 5 },
  { id: 'ts-6', label: '16:00 - 17:00', start: '16:00', end: '17:00', order: 6 },
  { id: 'ts-7', label: '17:00 - 18:00', start: '17:00', end: '18:00', order: 7 },
  { id: 'ts-8', label: '18:00 - 19:00', start: '18:00', end: '19:00', order: 8 },
  { id: 'ts-9', label: '19:00 - 20:00', start: '19:00', end: '20:00', order: 9 },
  { id: 'ts-10', label: '20:00 - 21:00', start: '20:00', end: '21:00', order: 10 },
  { id: 'ts-11', label: '21:00 - 22:00', start: '21:00', end: '22:00', order: 11 }
];

export function buildMockWeeks(): Week[] {
  const monday = getCurrentMonday();
  const weekStarts = Array.from({ length: 4 }).map((_, index) => addWeeks(monday, index));
  const weekLabels = ['Semana actual', 'Semana siguiente', 'En 2 semanas', 'En 3 semanas'];
  return [
    {
      id: 'week-current',
      label: `${weekLabels[0]} (${buildWeekLabel(weekStarts[0])})`,
      startDateISO: formatISO(weekStarts[0], { representation: 'date' })
    },
    {
      id: 'week-next',
      label: `${weekLabels[1]} (${buildWeekLabel(weekStarts[1])})`,
      startDateISO: formatISO(weekStarts[1], { representation: 'date' })
    },
    {
      id: 'week-plus-2',
      label: `${weekLabels[2]} (${buildWeekLabel(weekStarts[2])})`,
      startDateISO: formatISO(weekStarts[2], { representation: 'date' })
    },
    {
      id: 'week-plus-3',
      label: `${weekLabels[3]} (${buildWeekLabel(weekStarts[3])})`,
      startDateISO: formatISO(weekStarts[3], { representation: 'date' })
    }
  ];
}

export function buildEmptyWeekPlan(week: Week, employeeIds: string[], timeSlotIds: string[]): WeekPlan {
  // parseISO keeps YYYY-MM-DD in local timezone and avoids UTC day-shift (Domingo/Lunes mismatch)
  const start = parseISO(week.startDateISO);
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(start);
    date.setDate(start.getDate() + idx);
    const dateISO = formatISO(date, { representation: 'date' });
    const assignments: WeekPlan['days'][number]['assignments'] = {};
    for (const timeSlotId of timeSlotIds) {
      assignments[timeSlotId] = {};
      for (const employeeId of employeeIds) {
        assignments[timeSlotId][employeeId] = { roleId: null, code: 'LIBRE' };
      }
    }
    return { dateISO, dayName: formatDayNameEs(dateISO), assignments };
  });
  return { weekId: week.id, days };
}
