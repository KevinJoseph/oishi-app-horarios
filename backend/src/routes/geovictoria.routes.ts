import { Router } from 'express';
import {
  addGeoVictoriaUserController,
  getGeoVictoriaEmployeesController,
  getGeoVictoriaReciboEmployeesController
} from '../controllers/geovictoria.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';

export const geoVictoriaRouter = Router();

geoVictoriaRouter.get('/geovictoria/employees', requireAuth, requireAdmin, getGeoVictoriaEmployeesController);
geoVictoriaRouter.get('/geovictoria/recibo-employees', requireAuth, requireAdmin, getGeoVictoriaReciboEmployeesController);
geoVictoriaRouter.post('/geovictoria/users', requireAuth, requireAdmin, addGeoVictoriaUserController);
