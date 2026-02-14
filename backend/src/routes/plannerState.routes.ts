import { Router } from 'express';
import {
  getPlannerStateController,
  putPlannerStateController,
  resetPlannerStateController
} from '../controllers/plannerState.controller.js';

export const plannerStateRouter = Router();

plannerStateRouter.get('/state', getPlannerStateController);
plannerStateRouter.put('/state', putPlannerStateController);
plannerStateRouter.post('/state/reset', resetPlannerStateController);
