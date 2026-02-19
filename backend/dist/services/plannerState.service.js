import { PlannerStateModel } from '../models/PlannerState.js';
import { buildSeedState } from './seedState.js';
const STATE_KEY = 'default';
function sanitizePayload(payload) {
    return {
        employees: payload.employees,
        roles: payload.roles,
        timeSlots: payload.timeSlots,
        shiftRanges: payload.shiftRanges,
        weeks: payload.weeks,
        weekPlans: payload.weekPlans
    };
}
function mapUnknownState(raw) {
    const defaultShiftRanges = {
        day: { startHour: 12, endHour: 17 },
        night: { startHour: 17, endHour: 22 }
    };
    return {
        employees: raw.employees,
        roles: raw.roles,
        timeSlots: raw.timeSlots,
        shiftRanges: raw.shiftRanges ?? defaultShiftRanges,
        weeks: raw.weeks,
        weekPlans: raw.weekPlans
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
