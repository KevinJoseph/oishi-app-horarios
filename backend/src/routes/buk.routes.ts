import { Router } from 'express';
import {
  deleteBukRecintoController,
  listBukRecintosController,
  upsertBukRecintoController
} from '../controllers/bukRecinto.controller.js';
import { listBukShiftsController, registerBukShiftsController } from '../controllers/bukShift.controller.js';
import { requireAuth, requirePlannerWrite } from '../middlewares/auth.middleware.js';

export const bukRouter = Router();

bukRouter.get('/buk/recintos', requireAuth, listBukRecintosController);
bukRouter.put('/buk/recintos/:companyId', requireAuth, requirePlannerWrite, upsertBukRecintoController);
bukRouter.delete('/buk/recintos/:companyId', requireAuth, requirePlannerWrite, deleteBukRecintoController);
bukRouter.get('/buk/shifts', requireAuth, listBukShiftsController);
bukRouter.post('/buk/shifts/register', requireAuth, requirePlannerWrite, registerBukShiftsController);
