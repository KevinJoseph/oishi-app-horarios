import { EmployeeModel } from '../models/Employee.js';
import { WeekModel } from '../models/Week.js';
import { WeekPlanModel } from '../models/WeekPlan.js';
import { WeekConfigModel } from '../models/WeekConfig.js';
import { AreaSettingsModel } from '../models/AreaSettings.js';
import { RoleModel } from '../models/Role.js';
import { buildSeedState } from '../services/seedState.js';
function getMondayOfWeekISO(weekStartParam) {
    if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam))
        return weekStartParam;
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    });
    const parts = fmt.formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const weekday = get('weekday');
    const wmap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
    const w = wmap[weekday] ?? 1;
    const diff = w === 0 ? -6 : 1 - w;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
}
export async function getPublicEmployeeScheduleController(req, res) {
    const { employeeId } = req.params;
    if (!employeeId) {
        res.status(400).json({ error: 'Identificador del colaborador requerido.' });
        return;
    }
    const employeeDoc = await EmployeeModel.findOne({ baseEmployeeId: employeeId }).lean();
    if (!employeeDoc) {
        res.status(404).json({ error: 'Colaborador no encontrado.' });
        return;
    }
    const employeeData = employeeDoc.data;
    const companyId = employeeDoc.companyId;
    const areaId = employeeData.areaId ?? 'salon';
    const resolvedEmployeeId = employeeData.id ?? employeeDoc.baseEmployeeId;
    const weekStartParam = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined;
    const targetMondayISO = getMondayOfWeekISO(weekStartParam);
    const weekDoc = await WeekModel.findOne({ companyId, startDateISO: targetMondayISO }).lean();
    let weekPlan = null;
    let weekConfig = null;
    if (weekDoc) {
        const planDoc = await WeekPlanModel.findOne({ companyId, areaId, baseWeekId: weekDoc.baseWeekId }).lean();
        if (planDoc) {
            weekPlan = {
                days: planDoc.days,
                ...(planDoc.restDayOverrides ? { restDayOverrides: planDoc.restDayOverrides } : {})
            };
        }
        const configDoc = await WeekConfigModel.findOne({ companyId, areaId, baseWeekId: weekDoc.baseWeekId }).lean();
        if (configDoc) {
            weekConfig = { timeSlots: configDoc.timeSlots, breakConfig: configDoc.breakConfig };
        }
    }
    const areaSettings = await AreaSettingsModel.findOne({ companyId, areaId }).lean();
    const seed = buildSeedState();
    const timeSlots = weekConfig?.timeSlots && weekConfig.timeSlots.length > 0
        ? weekConfig.timeSlots
        : areaSettings?.timeSlots && areaSettings.timeSlots.length > 0
            ? areaSettings.timeSlots
            : seed.timeSlotsByArea[areaId] ?? seed.timeSlots;
    const breakConfig = weekConfig?.breakConfig ?? areaSettings?.breakConfig ?? seed.breakConfigByArea[areaId] ?? seed.breakConfig;
    const roleDocs = await RoleModel.find({ companyId, areaId }).lean();
    const roles = roleDocs.map((doc) => ({ ...doc.data, areaId: doc.areaId }));
    res.status(200).json({
        employee: {
            id: resolvedEmployeeId,
            name: employeeData.name ?? '',
            code: employeeData.code ?? '',
            identityDocument: employeeData.identityDocument ?? '',
            companyAlias: employeeData.companyAlias ?? '',
            companyName: employeeData.companyName ?? '',
            areaId,
            restDay: typeof employeeData.restDay === 'number' ? employeeData.restDay : null
        },
        weekStartDateISO: targetMondayISO,
        weekLabel: weekDoc?.label ?? null,
        days: weekPlan?.days ?? [],
        restDayOverrides: weekPlan?.restDayOverrides?.[resolvedEmployeeId] ?? null,
        timeSlots,
        breakConfig,
        roles
    });
}
