import { EmployeeModel } from '../models/Employee.js';
import { RoleModel } from '../models/Role.js';
import { WeekModel } from '../models/Week.js';
import { WeekPlanModel } from '../models/WeekPlan.js';
import { WeekConfigModel } from '../models/WeekConfig.js';
import { WeekAuditModel } from '../models/WeekAudit.js';
import { AreaSettingsModel } from '../models/AreaSettings.js';
import { AppSettingsModel } from '../models/AppSettings.js';
import { buildSeedState } from './seedState.js';
import { AREA_IDS } from '../types/planner.js';
const APP_SETTINGS_ID = 'default';
export const DEFAULT_COMPANY_ID = '__default__';
function isAreaId(value) {
    return typeof value === 'string' && AREA_IDS.includes(value);
}
function resolveCompanyId(companyId) {
    const trimmed = (companyId ?? '').trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_COMPANY_ID;
}
function scopedKey(companyId, areaId, baseWeekId) {
    return `${companyId}::${areaId}::${baseWeekId}`;
}
function areaSettingsKey(companyId, areaId) {
    return `${companyId}::${areaId}`;
}
function parseWeekScope(key) {
    const parts = key.split('::');
    if (parts.length !== 3)
        return null;
    const [companyId, areaId, baseWeekId] = parts;
    if (!isAreaId(areaId))
        return null;
    return { companyId, areaId, baseWeekId };
}
function defaultValidationRequirements() {
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
function sanitizeValidationRequirements(input) {
    const source = (input ?? {});
    const out = defaultValidationRequirements();
    for (const key of [0, 1, 2, 3, 4, 5, 6]) {
        const entry = source[key];
        if (entry) {
            out[key] = {
                opening: Number.isFinite(entry.opening) ? Math.max(0, Math.trunc(entry.opening)) : 0,
                closing: Number.isFinite(entry.closing) ? Math.max(0, Math.trunc(entry.closing)) : 0
            };
        }
    }
    return out;
}
/**
 * Legacy scopedWeekId from the frontend is `${areaId}::${weekId}`. Convert it to the
 * new internal `${companyId}::${areaId}::${weekId}` using the caller's company context.
 * Accepts either format to be lenient with stored validation keys.
 */
function normalizeIncomingScopedKey(rawKey, companyId) {
    const trimmed = rawKey.trim();
    if (!trimmed)
        return null;
    // Drop any legacy `::company:xxx` suffix.
    const withoutCompanySuffix = trimmed.replace(/::company:[^:]*$/i, '');
    const parts = withoutCompanySuffix.split('::');
    if (parts.length === 3) {
        const [, areaId, baseWeekId] = parts;
        if (!isAreaId(areaId))
            return null;
        return scopedKey(companyId, areaId, baseWeekId);
    }
    if (parts.length === 2) {
        const [areaId, baseWeekId] = parts;
        if (!isAreaId(areaId))
            return null;
        return scopedKey(companyId, areaId, baseWeekId);
    }
    return null;
}
async function ensureSeeded() {
    const [empCount, weekCount, appSettings] = await Promise.all([
        EmployeeModel.estimatedDocumentCount(),
        WeekModel.estimatedDocumentCount(),
        AppSettingsModel.findById(APP_SETTINGS_ID).lean()
    ]);
    if (empCount > 0 || weekCount > 0 || appSettings) {
        return;
    }
    const seed = buildSeedState();
    const ops = [];
    if (seed.employees.length > 0) {
        ops.push(EmployeeModel.insertMany(seed.employees.map((employee) => ({ _id: employee.id, data: employee })), { ordered: false }));
    }
    if (seed.weeks.length > 0) {
        ops.push(WeekModel.insertMany(seed.weeks.map((week) => ({
            _id: week.id,
            label: week.label,
            startDateISO: week.startDateISO
        })), { ordered: false }));
    }
    ops.push(AppSettingsModel.create({
        _id: APP_SETTINGS_ID,
        currentAreaId: seed.currentAreaId
    }));
    await Promise.all(ops);
}
export async function getOrCreatePlannerState(context) {
    await ensureSeeded();
    const { companyId } = context;
    const [employeeDocs, roleDocs, weekDocs, weekPlanDocs, weekConfigDocs, weekAuditDocs, areaSettingsDocs, appSettings] = await Promise.all([
        EmployeeModel.find({}).lean(),
        RoleModel.find({ companyId }).lean(),
        WeekModel.find({}).lean(),
        WeekPlanModel.find({ companyId }).lean(),
        WeekConfigModel.find({ companyId }).lean(),
        WeekAuditModel.find({ companyId }).lean(),
        AreaSettingsModel.find({ companyId }).lean(),
        AppSettingsModel.findById(APP_SETTINGS_ID).lean()
    ]);
    const employees = employeeDocs.map((doc) => doc.data);
    const roles = roleDocs.map((doc) => ({
        ...doc.data,
        companyId: doc.companyId,
        areaId: isAreaId(doc.areaId) ? doc.areaId : 'salon'
    }));
    const weeks = weekDocs.map((doc) => ({
        id: doc._id,
        label: doc.label,
        startDateISO: doc.startDateISO
    }));
    // Frontend keys expected as `${areaId}::${weekId}` (legacy format) — map from internal keys.
    const toLegacyScope = (areaId, baseWeekId) => `${areaId}::${baseWeekId}`;
    const weekPlans = {};
    for (const doc of weekPlanDocs) {
        const areaId = isAreaId(doc.areaId) ? doc.areaId : 'salon';
        const key = toLegacyScope(areaId, doc.baseWeekId);
        weekPlans[key] = {
            weekId: key,
            days: doc.days
        };
    }
    const weekConfigById = {};
    for (const doc of weekConfigDocs) {
        const areaId = isAreaId(doc.areaId) ? doc.areaId : 'salon';
        const key = toLegacyScope(areaId, doc.baseWeekId);
        weekConfigById[key] = {
            areaId,
            timeSlots: doc.timeSlots,
            shiftRanges: doc.shiftRanges,
            validationRequirements: sanitizeValidationRequirements(doc.validationRequirements),
            breakConfig: doc.breakConfig
        };
    }
    const weekAuditById = {};
    const validatedWeekIds = [];
    for (const doc of weekAuditDocs) {
        const areaId = isAreaId(doc.areaId) ? doc.areaId : 'salon';
        const key = toLegacyScope(areaId, doc.baseWeekId);
        weekAuditById[key] = {
            createdByName: doc.createdByName ?? null,
            validatedByName: doc.validatedByName ?? null
        };
        if (doc.validated) {
            validatedWeekIds.push(key);
        }
    }
    const defaultTimeSlots = [];
    const defaultShiftRanges = {
        day: { startHour: 12, endHour: 17 },
        night: { startHour: 17, endHour: 22 }
    };
    const defaultBreak = { enabled: false, startHour: 16, endHour: 17 };
    const timeSlotsByArea = {
        salon: defaultTimeSlots,
        cocina: defaultTimeSlots,
        oficina: defaultTimeSlots,
        produccion: defaultTimeSlots
    };
    const shiftRangesByArea = {
        salon: defaultShiftRanges,
        cocina: defaultShiftRanges,
        oficina: defaultShiftRanges,
        produccion: defaultShiftRanges
    };
    const validationRequirementsByArea = {
        salon: defaultValidationRequirements(),
        cocina: defaultValidationRequirements(),
        oficina: defaultValidationRequirements(),
        produccion: defaultValidationRequirements()
    };
    const breakConfigByArea = {
        salon: defaultBreak,
        cocina: defaultBreak,
        oficina: defaultBreak,
        produccion: defaultBreak
    };
    for (const doc of areaSettingsDocs) {
        if (!isAreaId(doc.areaId))
            continue;
        timeSlotsByArea[doc.areaId] = doc.timeSlots;
        shiftRangesByArea[doc.areaId] = doc.shiftRanges;
        validationRequirementsByArea[doc.areaId] = sanitizeValidationRequirements(doc.validationRequirements);
        breakConfigByArea[doc.areaId] = doc.breakConfig;
    }
    const currentAreaId = isAreaId(appSettings?.currentAreaId)
        ? appSettings.currentAreaId
        : 'salon';
    return {
        employees,
        roles,
        currentAreaId,
        timeSlots: timeSlotsByArea[currentAreaId],
        shiftRanges: shiftRangesByArea[currentAreaId],
        validationRequirements: validationRequirementsByArea[currentAreaId],
        breakConfig: breakConfigByArea[currentAreaId],
        timeSlotsByArea,
        shiftRangesByArea,
        validationRequirementsByArea,
        breakConfigByArea,
        weeks,
        weekPlans,
        validatedWeekIds,
        weekAuditById,
        weekConfigById
    };
}
async function replaceEmployees(employees) {
    const ids = employees.map((employee) => employee.id);
    const ops = employees.map((employee) => ({
        updateOne: {
            filter: { _id: employee.id },
            update: { $set: { data: employee } },
            upsert: true
        }
    }));
    if (ops.length > 0) {
        await EmployeeModel.bulkWrite(ops, { ordered: false });
    }
    await EmployeeModel.deleteMany({ _id: { $nin: ids } });
}
async function replaceRolesForCompany(companyId, roles) {
    const ids = roles.map((role) => role.id);
    const ops = roles.map((role) => {
        const areaId = isAreaId(role.areaId) ? role.areaId : 'salon';
        return {
            updateOne: {
                filter: { _id: role.id },
                update: {
                    $set: {
                        companyId,
                        areaId,
                        data: { ...role, companyId, areaId }
                    }
                },
                upsert: true
            }
        };
    });
    if (ops.length > 0) {
        await RoleModel.bulkWrite(ops, { ordered: false });
    }
    // Only delete roles for this company that are not in the payload.
    await RoleModel.deleteMany({ companyId, _id: { $nin: ids } });
}
async function replaceWeeks(weeks) {
    const ops = weeks.map((week) => ({
        updateOne: {
            filter: { _id: week.id },
            update: {
                $set: {
                    label: week.label,
                    startDateISO: week.startDateISO
                }
            },
            upsert: true
        }
    }));
    if (ops.length > 0) {
        await WeekModel.bulkWrite(ops, { ordered: false });
    }
}
async function upsertWeekPlan(companyId, legacyKey, plan) {
    const parts = legacyKey.split('::');
    if (parts.length !== 2)
        return;
    const [rawAreaId, baseWeekId] = parts;
    if (!isAreaId(rawAreaId))
        return;
    const areaId = rawAreaId;
    const id = scopedKey(companyId, areaId, baseWeekId);
    await WeekPlanModel.updateOne({ _id: id }, {
        $set: {
            companyId,
            areaId,
            baseWeekId,
            days: plan.days
        }
    }, { upsert: true });
}
async function upsertWeekConfig(companyId, legacyKey, config) {
    const parts = legacyKey.split('::');
    if (parts.length !== 2)
        return;
    const [rawAreaId, baseWeekId] = parts;
    if (!isAreaId(rawAreaId))
        return;
    const areaId = isAreaId(config.areaId) ? config.areaId : rawAreaId;
    const id = scopedKey(companyId, areaId, baseWeekId);
    await WeekConfigModel.updateOne({ _id: id }, {
        $set: {
            companyId,
            areaId,
            baseWeekId,
            timeSlots: config.timeSlots,
            shiftRanges: config.shiftRanges,
            validationRequirements: sanitizeValidationRequirements(config.validationRequirements),
            breakConfig: config.breakConfig
        }
    }, { upsert: true });
}
async function upsertWeekAudit(companyId, rawKey, audit, validated) {
    // Strip legacy `::company:xxx` suffix and normalize area+week.
    const withoutCompanySuffix = rawKey.replace(/::company:[^:]*$/i, '');
    const parts = withoutCompanySuffix.split('::');
    if (parts.length !== 2)
        return;
    const [rawAreaId, baseWeekId] = parts;
    if (!isAreaId(rawAreaId))
        return;
    const areaId = rawAreaId;
    const id = scopedKey(companyId, areaId, baseWeekId);
    const set = {
        companyId,
        areaId,
        baseWeekId
    };
    if (audit) {
        set.createdByName = audit.createdByName ?? null;
        set.validatedByName = audit.validatedByName ?? null;
    }
    if (typeof validated === 'boolean') {
        set.validated = validated;
    }
    await WeekAuditModel.updateOne({ _id: id }, { $set: set }, { upsert: true });
}
export async function updatePlannerStatePartial(context, payload) {
    const { companyId } = context;
    const ops = [];
    if (payload.employees)
        ops.push(replaceEmployees(payload.employees));
    if (payload.roles)
        ops.push(replaceRolesForCompany(companyId, payload.roles));
    if (payload.weeks)
        ops.push(replaceWeeks(payload.weeks));
    for (const entry of payload.weekEntries ?? []) {
        if (!entry.weekId?.trim())
            continue;
        if (entry.weekPlan) {
            ops.push(upsertWeekPlan(companyId, entry.weekId, entry.weekPlan));
        }
        if (entry.weekConfig) {
            ops.push(upsertWeekConfig(companyId, entry.weekId, entry.weekConfig));
        }
        if (entry.weekAudit || typeof entry.validated === 'boolean') {
            ops.push(upsertWeekAudit(companyId, entry.weekId, entry.weekAudit, entry.validated));
        }
    }
    await Promise.all(ops);
    return getOrCreatePlannerState(context);
}
export async function replacePlannerState(context, payload) {
    const { companyId } = context;
    await Promise.all([
        replaceEmployees(payload.employees),
        replaceRolesForCompany(companyId, payload.roles),
        replaceWeeks(payload.weeks),
        AppSettingsModel.updateOne({ _id: APP_SETTINGS_ID }, { $set: { currentAreaId: payload.currentAreaId } }, { upsert: true }),
        ...AREA_IDS.map((areaId) => AreaSettingsModel.updateOne({ _id: areaSettingsKey(companyId, areaId) }, {
            $set: {
                companyId,
                areaId,
                timeSlots: payload.timeSlotsByArea[areaId],
                shiftRanges: payload.shiftRangesByArea[areaId],
                validationRequirements: sanitizeValidationRequirements(payload.validationRequirementsByArea[areaId]),
                breakConfig: payload.breakConfigByArea[areaId]
            }
        }, { upsert: true }))
    ]);
    const weekPlanOps = Object.entries(payload.weekPlans).map(([key, plan]) => upsertWeekPlan(companyId, key, plan));
    const weekConfigOps = Object.entries(payload.weekConfigById).map(([key, config]) => upsertWeekConfig(companyId, key, config));
    const auditKeys = new Set([...Object.keys(payload.weekAuditById), ...payload.validatedWeekIds]);
    const weekAuditOps = Array.from(auditKeys).map((key) => upsertWeekAudit(companyId, key, payload.weekAuditById[key], payload.validatedWeekIds.includes(key)));
    await Promise.all([...weekPlanOps, ...weekConfigOps, ...weekAuditOps]);
    return getOrCreatePlannerState(context);
}
export async function updateValidationRequirements(context, payload) {
    const { companyId } = context;
    const sanitized = sanitizeValidationRequirements(payload.validationRequirements);
    await AreaSettingsModel.updateOne({ _id: areaSettingsKey(companyId, payload.areaId) }, {
        $set: {
            companyId,
            areaId: payload.areaId,
            validationRequirements: sanitized
        },
        $setOnInsert: {
            timeSlots: [],
            shiftRanges: { day: { startHour: 12, endHour: 17 }, night: { startHour: 17, endHour: 22 } },
            breakConfig: { enabled: false, startHour: 16, endHour: 17 }
        }
    }, { upsert: true });
    return getOrCreatePlannerState(context);
}
export async function resetPlannerState(context) {
    const { companyId } = context;
    await Promise.all([
        EmployeeModel.deleteMany({}),
        RoleModel.deleteMany({ companyId }),
        WeekPlanModel.deleteMany({ companyId }),
        WeekConfigModel.deleteMany({ companyId }),
        WeekAuditModel.deleteMany({ companyId }),
        AreaSettingsModel.deleteMany({ companyId })
    ]);
    return getOrCreatePlannerState(context);
}
export function buildPlannerContext(companyId) {
    return { companyId: resolveCompanyId(companyId) };
}
