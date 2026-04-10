const dayNameFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });
const mockRoles = [
    { id: 'role-corredor', name: 'Corredor', colorHex: '#c70a0a', validCodes: ['CO01'] },
    { id: 'role-despacho', name: 'Despacho', colorHex: '#68D391', validCodes: ['DE01'] },
    { id: 'role-bienvenida', name: 'Bienvenida', colorHex: '#63B3ED', validCodes: ['BIE01'] },
    { id: 'role-salon01', name: 'Salon Zona 1', colorHex: '#F6AD55', validCodes: ['SA01'] },
    { id: 'role-salon02', name: 'Salon Zona 2', colorHex: '#68D391', validCodes: ['SA02'] },
    { id: 'role-caja', name: 'Caja', colorHex: '#63B3ED', validCodes: ['CAJ01'] }
];
const mockEmployees = [
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
const mockTimeSlots = [
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
function buildDefaultShiftRanges(timeSlots) {
    const ordered = [...timeSlots].sort((a, b) => a.order - b.order);
    const startHour = Number.parseInt(ordered[0]?.start.slice(0, 2) ?? '12', 10);
    const endHour = Number.parseInt(ordered[ordered.length - 1]?.end.slice(0, 2) ?? '22', 10);
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
function buildDefaultValidationRequirements() {
    return {
        0: { opening: 0, closing: 0 },
        1: { opening: 0, closing: 0 },
        2: { opening: 0, closing: 0 },
        3: { opening: 0, closing: 0 },
        4: { opening: 0, closing: 0 },
        5: { opening: 0, closing: 0 },
        6: { opening: 0, closing: 0 }
    };
}
function buildDefaultBreakConfig(timeSlots) {
    const ordered = [...timeSlots].sort((a, b) => a.order - b.order);
    const startHour = Number.parseInt(ordered[0]?.start.slice(0, 2) ?? '12', 10);
    const endHour = Number.parseInt(ordered[ordered.length - 1]?.end.slice(0, 2) ?? '22', 10);
    const clampedStart = Math.min(startHour + 4, endHour - 1);
    const fallbackStart = Number.isInteger(clampedStart) ? clampedStart : Math.max(startHour, endHour - 1);
    const fallbackEnd = Math.min(fallbackStart + 1, endHour);
    return {
        enabled: false,
        startHour: fallbackStart,
        endHour: fallbackEnd
    };
}
function getCurrentMonday() {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() + diff);
    return monday;
}
function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
function toISODate(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}
function formatDayNameEs(dateISO) {
    const raw = dayNameFormatter.format(new Date(`${dateISO}T00:00:00`));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}
function formatWeekLabel(startDate) {
    const endDate = addDays(startDate, 6);
    const ddmm = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };
    return `${ddmm(startDate)} - ${ddmm(endDate)}`;
}
function buildWeeks() {
    const monday = getCurrentMonday();
    return Array.from({ length: 2 }).map((_, index) => {
        const start = addDays(monday, index * 7);
        const startDateISO = toISODate(start);
        return {
            id: `week-${startDateISO}`,
            label: formatWeekLabel(start),
            startDateISO
        };
    });
}
function buildEmptyWeekPlan(week, employeeIds, timeSlotIds) {
    const start = new Date(`${week.startDateISO}T00:00:00`);
    const days = Array.from({ length: 7 }).map((_, index) => {
        const date = addDays(start, index);
        const dateISO = toISODate(date);
        const assignments = {};
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
export function buildSeedState() {
    const employees = [...mockEmployees];
    const roles = [...mockRoles];
    const timeSlots = [...mockTimeSlots];
    const shiftRanges = buildDefaultShiftRanges(timeSlots);
    const validationRequirements = buildDefaultValidationRequirements();
    const breakConfig = buildDefaultBreakConfig(timeSlots);
    const weeks = buildWeeks();
    const weekPlans = {};
    const weekAuditById = {};
    const employeeIds = employees.map((employee) => employee.id);
    const timeSlotIds = timeSlots.map((slot) => slot.id);
    for (const week of weeks) {
        weekPlans[week.id] = buildEmptyWeekPlan(week, employeeIds, timeSlotIds);
        weekAuditById[week.id] = {
            createdByName: null,
            validatedByName: null
        };
    }
    return {
        employees,
        roles,
        currentAreaId: 'salon',
        timeSlots,
        shiftRanges,
        validationRequirements,
        breakConfig,
        timeSlotsByArea: {
            salon: [...timeSlots],
            cocina: [...timeSlots],
            oficina: [...timeSlots],
            produccion: [...timeSlots]
        },
        shiftRangesByArea: {
            salon: shiftRanges,
            cocina: shiftRanges,
            oficina: shiftRanges,
            produccion: shiftRanges
        },
        validationRequirementsByArea: {
            salon: validationRequirements,
            cocina: validationRequirements,
            oficina: validationRequirements,
            produccion: validationRequirements
        },
        breakConfigByArea: {
            salon: breakConfig,
            cocina: breakConfig,
            oficina: breakConfig,
            produccion: breakConfig
        },
        weeks,
        weekPlans,
        validatedWeekIds: [],
        weekAuditById,
        weekConfigById: {}
    };
}
