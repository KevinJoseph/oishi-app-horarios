import { Router } from 'express';
import { getGeoVictoriaEmployeesController } from '../controllers/geovictoria.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';

export const geoVictoriaRouter = Router();

geoVictoriaRouter.get('/geovictoria/employees', requireAuth, requireAdmin, getGeoVictoriaEmployeesController);
