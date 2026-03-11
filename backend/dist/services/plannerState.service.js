import { PlannerStateModel } from '../models/PlannerState.js';
import { buildSeedState } from './seedState.js';
import { AREA_IDS } from '../types/planner.js';
const STATE_KEY = 'default';
function isAreaId(value) {
    return typeof value === 'string' && AREA_IDS.includes(value);
}
function sanitizeValidationRequirements(input) {
    const source = (input ?? {});
    return {
        0: {
            opening: Number.isFinite(source[0]?.opening) ? Math.max(0, Math.trunc(source[0].opening)) : 0,
            closing: Number.isFinite(source[0]?.closing) ? Math.max(0, Math.trunc(source[0].closing)) : 0
        },
        1: {
            opening: Number.isFinite(source[1]?.opening) ? Math.max(0, Math.trunc(source[1].opening)) : 0,
            closing: Number.isFinite(source[1]?.closing) ? Math.max(0, Math.trunc(source[1].closing)) : 0
        },
        2: {
            opening: Number.isFinite(source[2]?.opening) ? Math.max(0, Math.trunc(source[2].opening)) : 0,
            closing: Number.isFinite(source[2]?.closing) ? Math.max(0, Math.trunc(source[2].closing)) : 0
        },
        3: {
            opening: Number.isFinite(source[3]?.opening) ? Math.max(0, Math.trunc(source[3].opening)) : 0,
            closing: Number.isFinite(source[3]?.closing) ? Math.max(0, Math.trunc(source[3].closing)) : 0
        },
        4: {
            opening: Number.isFinite(source[4]?.opening) ? Math.max(0, Math.trunc(source[4].opening)) : 0,
            closing: Number.isFinite(source[4]?.closing) ? Math.max(0, Math.trunc(source[4].closing)) : 0
        },
        5: {
            opening: Number.isFinite(source[5]?.opening) ? Math.max(0, Math.trunc(source[5].opening)) : 0,
            closing: Number.isFinite(source[5]?.closing) ? Math.max(0, Math.trunc(source[5].closing)) : 0
        },
        6: {
            opening: Number.isFinite(source[6]?.opening) ? Math.max(0, Math.trunc(source[6].opening)) : 0,
            closing: Number.isFinite(source[6]?.closing) ? Math.max(0, Math.trunc(source[6].closing)) : 0
        }
    };
}
function clearAllWeekValidators(weekAuditById) {
    const next = {};
    for (const [weekId, audit] of Object.entries(weekAuditById)) {
        next[weekId] = {
            ...audit,
            validatedByName: null
        };
    }
    return next;
}
function sanitizePayload(payload) {
    return {
        employees: payload.employees,
        roles: payload.roles,
        currentAreaId: payload.currentAreaId,
        timeSlots: payload.timeSlots,
        shiftRanges: payload.shiftRanges,
        validationRequirements: payload.validationRequirements,
        breakConfig: payload.breakConfig,
        timeSlotsByArea: payload.timeSlotsByArea,
        shiftRangesByArea: payload.shiftRangesByArea,
        validationRequirementsByArea: payload.validationRequirementsByArea,
        breakConfigByArea: payload.breakConfigByArea,
        weeks: payload.weeks,
        weekPlans: payload.weekPlans,
        validatedWeekIds: payload.validatedWeekIds,
        weekAuditById: payload.weekAuditById
    };
}
function mapUnknownState(raw) {
    const defaultShiftRanges = {
        day: { startHour: 12, endHour: 17 },
        night: { startHour: 17, endHour: 22 }
    };
    const defaultValidationRequirements = {
        0: { opening: 0, closing: 0 },
        1: { opening: 0, closing: 0 },
        2: { opening: 0, closing: 0 },
        3: { opening: 0, closing: 0 },
        4: { opening: 0, closing: 0 },
        5: { opening: 0, closing: 0 },
        6: { opening: 0, closing: 0 }
    };
    const defaultBreakConfig = {
        enabled: false,
        startHour: 16,
        endHour: 17
    };
    return {
        employees: raw.employees,
        roles: raw.roles,
        currentAreaId: isAreaId(raw.currentAreaId) ? raw.currentAreaId : 'salon',
        timeSlots: raw.timeSlots,
        shiftRanges: raw.shiftRanges ?? defaultShiftRanges,
        validationRequirements: raw.validationRequirements ?? defaultValidationRequirements,
        breakConfig: raw.breakConfig ?? defaultBreakConfig,
        timeSlotsByArea: raw.timeSlotsByArea && typeof raw.timeSlotsByArea === 'object'
            ? {
                salon: raw.timeSlotsByArea.salon ??
                    raw.timeSlots,
                cocina: raw.timeSlotsByArea.cocina ??
                    raw.timeSlots,
                oficina: raw.timeSlotsByArea.oficina ??
                    raw.timeSlots,
                produccion: raw.timeSlotsByArea.produccion ??
                    raw.timeSlots
            }
            : {
                salon: raw.timeSlots,
                cocina: raw.timeSlots,
                oficina: raw.timeSlots,
                produccion: raw.timeSlots
            },
        shiftRangesByArea: raw.shiftRangesByArea && typeof raw.shiftRangesByArea === 'object'
            ? {
                salon: raw.shiftRangesByArea.salon ??
                    (raw.shiftRanges ?? defaultShiftRanges),
                cocina: raw.shiftRangesByArea.cocina ??
                    (raw.shiftRanges ?? defaultShiftRanges),
                oficina: raw.shiftRangesByArea.oficina ??
                    (raw.shiftRanges ?? defaultShiftRanges),
                produccion: raw.shiftRangesByArea.produccion ??
                    (raw.shiftRanges ?? defaultShiftRanges)
            }
            : {
                salon: (raw.shiftRanges ?? defaultShiftRanges),
                cocina: (raw.shiftRanges ?? defaultShiftRanges),
                oficina: (raw.shiftRanges ?? defaultShiftRanges),
                produccion: (raw.shiftRanges ?? defaultShiftRanges)
            },
        validationRequirementsByArea: raw.validationRequirementsByArea && typeof raw.validationRequirementsByArea === 'object'
            ? {
                salon: raw.validationRequirementsByArea.salon ??
                    (raw.validationRequirements ?? defaultValidationRequirements),
                cocina: raw.validationRequirementsByArea.cocina ??
                    (raw.validationRequirements ?? defaultValidationRequirements),
                oficina: raw.validationRequirementsByArea.oficina ??
                    (raw.validationRequirements ?? defaultValidationRequirements),
                produccion: raw.validationRequirementsByArea.produccion ??
                    (raw.validationRequirements ?? defaultValidationRequirements)
            }
            : {
                salon: (raw.validationRequirements ?? defaultValidationRequirements),
                cocina: (raw.validationRequirements ?? defaultValidationRequirements),
                oficina: (raw.validationRequirements ?? defaultValidationRequirements),
                produccion: (raw.validationRequirements ?? defaultValidationRequirements)
            },
        breakConfigByArea: raw.breakConfigByArea && typeof raw.breakConfigByArea === 'object'
            ? {
                salon: raw.breakConfigByArea.salon ??
                    (raw.breakConfig ?? defaultBreakConfig),
                cocina: raw.breakConfigByArea.cocina ??
                    (raw.breakConfig ?? defaultBreakConfig),
                oficina: raw.breakConfigByArea.oficina ??
                    (raw.breakConfig ?? defaultBreakConfig),
                produccion: raw.breakConfigByArea.produccion ??
                    (raw.breakConfig ?? defaultBreakConfig)
            }
            : {
                salon: (raw.breakConfig ?? defaultBreakConfig),
                cocina: (raw.breakConfig ?? defaultBreakConfig),
                oficina: (raw.breakConfig ?? defaultBreakConfig),
                produccion: (raw.breakConfig ?? defaultBreakConfig)
            },
        weeks: raw.weeks,
        weekPlans: raw.weekPlans,
        validatedWeekIds: Array.isArray(raw.validatedWeekIds)
            ? raw.validatedWeekIds.filter((value) => typeof value === 'string')
            : [],
        weekAuditById: raw.weekAuditById && typeof raw.weekAuditById === 'object'
            ? raw.weekAuditById
            : {}
    };
}
export async function getOrCreatePlannerState() {
    const existing = await PlannerStateModel.findOne({ key: STATE_KEY }).lean();
    if (existing) {
        return mapUnknownState(existing);
    }
    const seed = buildSeedState();
    await PlannerStateModel.create({ key: STATE_KEY, ...seed });
    return seed;
}
export async function replacePlannerState(payload) {
    const sanitized = sanitizePayload(payload);
    const updated = await PlannerStateModel.findOneAndUpdate({ key: STATE_KEY }, { $set: sanitized }, { upsert: true, new: true, setDefaultsOnInsert: true, lean: true });
    if (!updated) {
        throw new Error('Failed to persist planner state');
    }
    return mapUnknownState(updated);
}
export async function updateValidationRequirements(payload) {
    const current = await getOrCreatePlannerState();
    const sanitized = sanitizeValidationRequirements(payload.validationRequirements);
    const nextState = {
        ...current,
        validationRequirements: sanitized,
        validationRequirementsByArea: {
            ...current.validationRequirementsByArea,
            [payload.areaId]: sanitized
        },
        validatedWeekIds: [],
        weekAuditById: clearAllWeekValidators(current.weekAuditById)
    };
    const updated = await PlannerStateModel.findOneAndUpdate({ key: STATE_KEY }, {
        $set: {
            validationRequirements: nextState.validationRequirements,
            validationRequirementsByArea: nextState.validationRequirementsByArea,
            validatedWeekIds: nextState.validatedWeekIds,
            weekAuditById: nextState.weekAuditById
        }
    }, { upsert: true, new: true, setDefaultsOnInsert: true, lean: true });
    if (!updated) {
        throw new Error('Failed to persist validation requirements');
    }
    return mapUnknownState(updated);
}
export async function resetPlannerState() {
    const seed = buildSeedState();
    const resetState = {
        ...seed,
        employees: seed.employees.map((employee) => ({
            ...employee,
            contractType: undefined,
            shiftType: undefined,
            weeklyHours: 0
        }))
    };
    await PlannerStateModel.findOneAndUpdate({ key: STATE_KEY }, { $set: resetState }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return resetState;
}
