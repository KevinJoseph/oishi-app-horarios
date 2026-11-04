import { Router } from 'express';
import {
  createAreaController,
  deleteAreaController,
  listAreasController,
  updateAreaController
} from '../controllers/area.controller.js';
import {
  createSubAreaController,
  deleteSubAreaController,
  listAllSubAreasController,
  listSubAreasController,
  updateSubAreaController
} from '../controllers/subArea.controller.js';
import { requireAuth, requirePlannerWrite } from '../middlewares/auth.middleware.js';

export const areaRouter = Router();

areaRouter.get('/areas', requireAuth, listAreasController);
areaRouter.get('/subareas', requireAuth, listAllSubAreasController);
areaRouter.post('/areas', requireAuth, requirePlannerWrite, createAreaController);
areaRouter.put('/areas/:code', requireAuth, requirePlannerWrite, updateAreaController);
areaRouter.delete('/areas/:code', requireAuth, requirePlannerWrite, deleteAreaController);

// Sub-áreas (solo organizativas, sin impacto en planificación)
areaRouter.get('/areas/:code/subareas', requireAuth, listSubAreasController);
areaRouter.post('/areas/:code/subareas', requireAuth, requirePlannerWrite, createSubAreaController);
areaRouter.put('/areas/:code/subareas/:subCode', requireAuth, requirePlannerWrite, updateSubAreaController);
areaRouter.delete('/areas/:code/subareas/:subCode', requireAuth, requirePlannerWrite, deleteSubAreaController);
