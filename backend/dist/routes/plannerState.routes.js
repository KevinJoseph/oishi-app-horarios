import { Router } from 'express';
import { getPlannerStateController, putPlannerStateController, resetPlannerStateController } from '../controllers/plannerState.controller.js';
import { requireAdmin, requireAuth, requirePlannerWrite } from '../middlewares/auth.middleware.js';
export const plannerStateRouter = Router();
plannerStateRouter.get('/state', requireAuth, getPlannerStateController);
plannerStateRouter.put('/state', requireAuth, requirePlannerWrite, putPlannerStateController);
plannerStateRouter.post('/state/reset', requireAuth, requireAdmin, resetPlannerStateController);
