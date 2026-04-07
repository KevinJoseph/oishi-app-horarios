import { getOrCreatePlannerState, replacePlannerState, resetPlannerState, updatePlannerStatePartial, updateValidationRequirements } from '../services/plannerState.service.js';
export async function getPlannerStateController(_req, res) {
    const state = await getOrCreatePlannerState();
    res.status(200).json(state);
}
export async function putPlannerStateController(req, res) {
    const payload = req.body;
    const updated = await replacePlannerState(payload);
    res.status(200).json(updated);
}
export async function putPlannerStatePartialController(req, res) {
    const payload = req.body;
    await updatePlannerStatePartial(payload);
    res.status(200).json({ ok: true });
}
export async function putValidationRequirementsController(req, res) {
    const payload = req.body;
    const updated = await updateValidationRequirements(payload);
    res.status(200).json(updated);
}
export async function resetPlannerStateController(_req, res) {
    const seed = await resetPlannerState();
    res.status(200).json(seed);
}
