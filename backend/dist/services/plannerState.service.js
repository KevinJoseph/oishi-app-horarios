import { EmployeeModel } from '../models/Employee.js';
import { RoleModel } from '../models/Role.js';
import { WeekModel } from '../models/Week.js';
import { WeekPlanModel } from '../models/WeekPlan.js';
import { WeekConfigModel } from '../models/WeekConfig.js';
import { WeekAuditModel } from '../models/WeekAudit.js';
import { AreaSettingsModel } from '../models/AreaSettings.js';
import { AppSettingsModel } from '../models/AppSettings.js';
import { AreaModel } from '../models/Area.js';
import { buildSeedState } from './seedState.js';
const APP_SETTINGS_ID = 'default';
export const DEFAULT_COMPANY_ID = '__default__';
function isValidAreaCode(value) {
    return typeof value === 'string' && value.trim().length > 0;
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
    if (!isValidAreaCode(areaId))
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
        if (!isValidAreaCode(areaId))
            return null;
        return scopedKey(companyId, areaId, baseWeekId);
    }
    if (parts.length === 2) {
        const [areaId, baseWeekId] = parts;
        if (!isValidAreaCode(areaId))
            return null;
        return scopedKey(companyId, areaId, baseWeekId);
    }
    return null;
}
async function ensureSeeded() {
    const appSettings = await AppSettingsModel.findById(APP_SETTINGS_ID).lean();
    if (appSettings)
        return;
    const seed = buildSeedState();
    await AppSettingsModel.create({
        _id: APP_SETTINGS_ID,
        currentAreaId: seed.currentAreaId
    });
}
export async function getOrCreatePlannerState(context) {
    await ensureSeeded();
    const { companyId } = context;
    const [areaDocs, employeeDocs, roleDocs, weekDocs, weekPlanDocs, weekConfigDocs, weekAuditDocs, areaSettingsDocs, appSettings] = await Promise.all([
        AreaModel.find({ companyId }).sort({ order: 1, code: 1 }).lean(),
        EmployeeModel.find({ companyId }).lean(),
        RoleModel.find({ companyId }).lean(),
        WeekModel.find({ companyId }).lean(),
        WeekPlanModel.find({ companyId }).lean(),
        WeekConfigModel.find({ companyId }).lean(),
        WeekAuditModel.find({ companyId }).lean(),
        AreaSettingsModel.find({ companyId }).lean(),
        AppSettingsModel.findById(APP_SETTINGS_ID).lean()
    ]);
    const areas = areaDocs.map((doc) => ({
        code: doc.code,
        label: doc.label,
        order: doc.order
    }));
    const dynamicAreaCodes = new Set(areas.map((a) => a.code));
    for (const doc of areaSettingsDocs) {
        if (isValidAreaCode(doc.areaId))
            dynamicAreaCodes.add(doc.areaId);
    }
    for (const doc of weekConfigDocs) {
        if (isValidAreaCode(doc.areaId))
            dynamicAreaCodes.add(doc.areaId);
    }
    for (const doc of weekPlanDocs) {
        if (isValidAreaCode(doc.areaId))
            dynamicAreaCodes.add(doc.areaId);
    }
    const areaCodes = Array.from(dynamicAreaCodes);
    const employees = employeeDocs.map((doc) => doc.data);
    const roles = roleDocs.map((doc) => ({
        ...doc.data,
        companyId: doc.companyId,
        areaId: isValidAreaCode(doc.areaId) ? doc.areaId : areaCodes[0] ?? 'default'
    }));
    const weeks = weekDocs.map((doc) => ({
        id: doc.baseWeekId,
        label: doc.label,
        startDateISO: doc.startDateISO
    }));
    const toLegacyScope = (areaId, baseWeekId) => `${areaId}::${baseWeekId}`;
    const weekPlans = {};
    for (const doc of weekPlanDocs) {
        const areaId = isValidAreaCode(doc.areaId) ? doc.areaId : areaCodes[0] ?? 'default';
        const key = toLegacyScope(areaId, doc.baseWeekId);
        weekPlans[key] = { weekId: key, days: doc.days };
    }
    const weekConfigById = {};
    for (const doc of weekConfigDocs) {
        const areaId = isValidAreaCode(doc.areaId) ? doc.areaId : areaCodes[0] ?? 'default';
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
        const areaId = isValidAreaCode(doc.areaId) ? doc.areaId : areaCodes[0] ?? 'default';
        const key = toLegacyScope(areaId, doc.baseWeekId);
        weekAuditById[key] = {
            createdByName: doc.createdByName ?? null,
            validatedByName: doc.validatedByName ?? null
        };
        if (doc.validated)
            validatedWeekIds.push(key);
    }
    const seedState = buildSeedState();
    const defaultTimeSlots = seedState.timeSlots;
    const defaultShiftRanges = seedState.shiftRanges;
    const defaultBreak = seedState.breakConfig;
    const timeSlotsByArea = {};
    const shiftRangesByArea = {};
    const validationRequirementsByArea = {};
    const breakConfigByArea = {};
    for (const code of areaCodes) {
        timeSlotsByArea[code] = seedState.timeSlotsByArea[code] ?? defaultTimeSlots;
        shiftRangesByArea[code] = seedState.shiftRangesByArea[code] ?? defaultShiftRanges;
        validationRequirementsByArea[code] = seedState.validationRequirementsByArea[code] ?? defaultValidationRequirements();
        breakConfigByArea[code] = seedState.breakConfigByArea[code] ?? defaultBreak;
    }
    for (const doc of areaSettingsDocs) {
        if (!isValidAreaCode(doc.areaId))
            continue;
        const fallbackAreaTimeSlots = seedState.timeSlotsByArea[doc.areaId] ?? defaultTimeSlots;
        const sanitizedTimeSlots = Array.isArray(doc.timeSlots) && doc.timeSlots.length > 0
            ? doc.timeSlots
            : fallbackAreaTimeSlots;
        timeSlotsByArea[doc.areaId] = sanitizedTimeSlots;
        shiftRangesByArea[doc.areaId] = doc.shiftRanges ?? (seedState.shiftRangesByArea[doc.areaId] ?? defaultShiftRanges);
        validationRequirementsByArea[doc.areaId] = sanitizeValidationRequirements(doc.validationRequirements);
        breakConfigByArea[doc.areaId] = doc.breakConfig ?? (seedState.breakConfigByArea[doc.areaId] ?? defaultBreak);
    }
    const currentAreaId = isValidAreaCode(appSettings?.currentAreaId)
        ? appSettings.currentAreaId
        : areaCodes[0] ?? 'default';
    return {
        areas,
        employees,
        roles,
        currentAreaId,
        timeSlots: timeSlotsByArea[currentAreaId] ?? defaultTimeSlots,
        shiftRanges: shiftRangesByArea[currentAreaId] ?? defaultShiftRanges,
        validationRequirements: validationRequirementsByArea[currentAreaId] ?? defaultValidationRequirements(),
        breakConfig: breakConfigByArea[currentAreaId] ?? defaultBreak,
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
async function replaceEmployeesForCompany(companyId, employees) {
    const ids = [];
    const ops = employees.map((employee) => {
        const id = `${companyId}::${employee.id}`;
        ids.push(id);
        return {
            updateOne: {
                filter: { _id: id },
                update: { $set: { companyId, baseEmployeeId: employee.id, data: employee } },
                upsert: true
            }
        };
    });
    if (ops.length > 0) {
        await EmployeeModel.bulkWrite(ops, { ordered: false });
    }
    await EmployeeModel.deleteMany({ companyId, _id: { $nin: ids } });
}
async function replaceRolesForCompany(companyId, roles) {
    const ids = roles.map((role) => role.id);
    const ops = roles.map((role) => {
        const areaId = isValidAreaCode(role.areaId) ? role.areaId : 'salon';
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
async function replaceWeeksForCompany(companyId, weeks) {
    const ids = [];
    const ops = weeks.map((week) => {
        const id = `${companyId}::${week.id}`;
        ids.push(id);
        return {
            updateOne: {
                filter: { _id: id },
                update: {
                    $set: {
                        companyId,
                        baseWeekId: week.id,
                        label: week.label,
                        startDateISO: week.startDateISO
                    }
                },
                upsert: true
            }
        };
    });
    if (ops.length > 0) {
        await WeekModel.bulkWrite(ops, { ordered: false });
    }
    await WeekModel.deleteMany({ companyId, _id: { $nin: ids } });
}
async function upsertWeekPlan(companyId, legacyKey, plan) {
    const parts = legacyKey.split('::');
    if (parts.length !== 2)
        return;
    const [rawAreaId, baseWeekId] = parts;
    if (!isValidAreaCode(rawAreaId))
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
    if (!isValidAreaCode(rawAreaId))
        return;
    const areaId = isValidAreaCode(config.areaId) ? config.areaId : rawAreaId;
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
    if (!isValidAreaCode(rawAreaId))
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
        ops.push(replaceEmployeesForCompany(companyId, payload.employees));
    if (payload.roles)
        ops.push(replaceRolesForCompany(companyId, payload.roles));
    if (payload.weeks)
        ops.push(replaceWeeksForCompany(companyId, payload.weeks));
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
    for (const entry of payload.areaSettings ?? []) {
        if (!entry.areaId?.trim())
            continue;
        const id = areaSettingsKey(companyId, entry.areaId);
        const setFields = { companyId, areaId: entry.areaId };
        if (entry.timeSlots)
            setFields.timeSlots = entry.timeSlots;
        if (entry.shiftRanges)
            setFields.shiftRanges = entry.shiftRanges;
        if (entry.validationRequirements)
            setFields.validationRequirements = sanitizeValidationRequirements(entry.validationRequirements);
        if (entry.breakConfig)
            setFields.breakConfig = entry.breakConfig;
        ops.push(AreaSettingsModel.updateOne({ _id: id }, {
            $set: setFields,
            $setOnInsert: {
                ...(!entry.timeSlots ? { timeSlots: [] } : {}),
                ...(!entry.shiftRanges ? { shiftRanges: { day: { startHour: 12, endHour: 17 }, night: { startHour: 17, endHour: 22 } } } : {}),
                ...(!entry.validationRequirements ? { validationRequirements: defaultValidationRequirements() } : {}),
                ...(!entry.breakConfig ? { breakConfig: { enabled: false, startHour: 16, endHour: 17 } } : {})
            }
        }, { upsert: true }));
    }
    await Promise.all(ops);
}
export async function replacePlannerState(context, payload) {
    const { companyId } = context;
    await Promise.all([
        replaceEmployeesForCompany(companyId, payload.employees),
        replaceRolesForCompany(companyId, payload.roles),
        replaceWeeksForCompany(companyId, payload.weeks),
        AppSettingsModel.updateOne({ _id: APP_SETTINGS_ID }, { $set: { currentAreaId: payload.currentAreaId } }, { upsert: true }),
        ...Object.keys(payload.timeSlotsByArea).map((areaId) => AreaSettingsModel.updateOne({ _id: areaSettingsKey(companyId, areaId) }, {
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
        EmployeeModel.deleteMany({ companyId }),
        RoleModel.deleteMany({ companyId }),
        WeekModel.deleteMany({ companyId }),
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
