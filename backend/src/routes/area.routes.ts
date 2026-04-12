import { Router } from 'express';
import {
  createAreaController,
  deleteAreaController,
  listAreasController,
  updateAreaController
} from '../controllers/area.controller.js';
import { requireAuth, requirePlannerWrite } from '../middlewares/auth.middleware.js';

export const areaRouter = Router();

areaRouter.get('/areas', requireAuth, listAreasController);
areaRouter.post('/areas', requireAuth, requirePlannerWrite, createAreaController);
areaRouter.put('/areas/:code', requireAuth, requirePlannerWrite, updateAreaController);
areaRouter.delete('/areas/:code', requireAuth, requirePlannerWrite, deleteAreaController);
