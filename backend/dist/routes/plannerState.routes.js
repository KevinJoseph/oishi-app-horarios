import { Router } from 'express';
import { getPlannerStateController, putPlannerStatePartialController, putPlannerStateController, putValidationRequirementsController, resetPlannerStateController } from '../controllers/plannerState.controller.js';
import { requireAdmin, requireAuth, requirePlannerWrite } from '../middlewares/auth.middleware.js';
export const plannerStateRouter = Router();
plannerStateRouter.get('/state', requireAuth, getPlannerStateController);
plannerStateRouter.put('/state', requireAuth, requirePlannerWrite, putPlannerStateController);
plannerStateRouter.put('/state/partial', requireAuth, requirePlannerWrite, putPlannerStatePartialController);
plannerStateRouter.put('/state/validation-requirements', requireAuth, requirePlannerWrite, putValidationRequirementsController);
plannerStateRouter.post('/state/reset', requireAuth, requireAdmin, resetPlannerStateController);
