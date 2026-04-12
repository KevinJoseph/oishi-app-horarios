import { buildPlannerContext, getOrCreatePlannerState, replacePlannerState, resetPlannerState, updatePlannerStatePartial, updateValidationRequirements } from '../services/plannerState.service.js';
function contextFromRequest(req) {
    const override = req.query.companyId;
    const userCompanyId = req.authUser?.companyId ?? null;
    const isAdmin = req.authUser?.role === 'super_administrador' || req.authUser?.role === 'supervisor';
    const companyId = (isAdmin && override) ? override : userCompanyId;
    return buildPlannerContext(companyId);
}
export async function getPlannerStateController(req, res) {
    const state = await getOrCreatePlannerState(contextFromRequest(req));
    res.status(200).json(state);
}
export async function putPlannerStateController(req, res) {
    const payload = req.body;
    const updated = await replacePlannerState(contextFromRequest(req), payload);
    res.status(200).json(updated);
}
export async function putPlannerStatePartialController(req, res) {
    const payload = req.body;
    await updatePlannerStatePartial(contextFromRequest(req), payload);
    res.status(200).json({ ok: true });
}
export async function putValidationRequirementsController(req, res) {
    const payload = req.body;
    const updated = await updateValidationRequirements(contextFromRequest(req), payload);
    res.status(200).json(updated);
}
export async function resetPlannerStateController(req, res) {
    const seed = await resetPlannerState(contextFromRequest(req));
    res.status(200).json(seed);
}
