import type { Employee, PlannerStatePayload, Role, TimeSlot, Week, WeekPlan } from '../types/planner.js';

const dayNameFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });

const mockRoles: Role[] = [
  { id: 'role-corredor', name: 'Corredor', colorHex: '#c70a0a', validCodes: ['CO01'] },
  { id: 'role-despacho', name: 'Despacho', colorHex: '#68D391', validCodes: ['DE01'] },
  { id: 'role-bienvenida', name: 'Bienvenida', colorHex: '#63B3ED', validCodes: ['BIE01'] },
  { id: 'role-salon01', name: 'Salon Zona 1', colorHex: '#F6AD55', validCodes: ['SA01'] },
  { id: 'role-salon02', name: 'Salon Zona 2', colorHex: '#68D391', validCodes: ['SA02'] },
  { id: 'role-caja', name: 'Caja', colorHex: '#63B3ED', validCodes: ['CAJ01'] }
];

const mockEmployees: Employee[] = [
  { id: 'emp-1', name: 'Ana Pérez', active: true, mainRoleId: 'role-caja', phone: '555-1001' },
  { id: 'emp-2', name: 'Luis Gómez', active: true, mainRoleId: 'role-role-corredor', phone: '555-1002' },
  { id: 'emp-3', name: 'Marta Ruiz', active: true, mainRoleId: 'role-corredor', phone: '555-1003' },
  { id: 'emp-4', name: 'Diego León', active: true, mainRoleId: 'role-salon01', phone: '555-1004' },
  { id: 'emp-5', name: 'Carla Díaz', active: true, mainRoleId: 'role-salon01', phone: '555-1005' }
];

const mockTimeSlots: TimeSlot[] = [
  { id: 'ts-1', label: '11:00 - 12:00', start: '11:00', end: '12:00', order: 1 },
  { id: 'ts-2', label: '11:45 - 13:00', start: '11:45', end: '13:00', order: 2 },
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

function getCurrentMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diff);
  return monday;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toISODate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDayNameEs(dateISO: string): string {
  const raw = dayNameFormatter.format(new Date(`${dateISO}T00:00:00`));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatWeekLabel(startDate: Date): string {
  const endDate = addDays(startDate, 6);
  const ddmm = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };
  return `${ddmm(startDate)} - ${ddmm(endDate)}`;
}

function buildWeeks(): Week[] {
  const monday = getCurrentMonday();
  const nextMonday = addDays(monday, 7);
  return [
    {
      id: 'week-current',
      label: `Semana actual (${formatWeekLabel(monday)})`,
      startDateISO: toISODate(monday)
    },
    {
      id: 'week-next',
      label: `Semana siguiente (${formatWeekLabel(nextMonday)})`,
      startDateISO: toISODate(nextMonday)
    }
  ];
}

function buildEmptyWeekPlan(week: Week, employeeIds: string[], timeSlotIds: string[]): WeekPlan {
  const start = new Date(`${week.startDateISO}T00:00:00`);
  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = addDays(start, index);
    const dateISO = toISODate(date);
    const assignments: WeekPlan['days'][number]['assignments'] = {};

    for (const timeSlotId of timeSlotIds) {
      assignments[timeSlotId] = {};
      for (const employeeId of employeeIds) {
        assignments[timeSlotId][employeeId] = { roleId: null, code: 'LIBRE' };
      }
    }

    return {
      dateISO,
      dayName: formatDayNameEs(dateISO),
      assignments
    };
  });

  return { weekId: week.id, days };
}

export function buildSeedState(): PlannerStatePayload {
  const employees = [...mockEmployees];
  const roles = [...mockRoles];
  const timeSlots = [...mockTimeSlots];
  const weeks = buildWeeks();
  const weekPlans: Record<string, WeekPlan> = {};

  const employeeIds = employees.map((employee) => employee.id);
  const timeSlotIds = timeSlots.map((slot) => slot.id);

  for (const week of weeks) {
    weekPlans[week.id] = buildEmptyWeekPlan(week, employeeIds, timeSlotIds);
  }

  return {
    employees,
    roles,
    timeSlots,
    weeks,
    weekPlans
  };
}
