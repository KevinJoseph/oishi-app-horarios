import { Router } from 'express';
import {
  addGeoVictoriaUserController,
  getGeoVictoriaCompaniesController,
  getGeoVictoriaEmployeesController,
  getGeoVictoriaPositionsController,
  getGeoVictoriaReciboEmployeesController,
  migrateGeoVictoriaPlanningController
} from '../controllers/geovictoria.controller.js';
import { requireAdmin, requireAuth, requirePlannerWrite } from '../middlewares/auth.middleware.js';

export const geoVictoriaRouter = Router();

geoVictoriaRouter.get('/geovictoria/employees', requireAuth, requireAdmin, getGeoVictoriaEmployeesController);
geoVictoriaRouter.get('/geovictoria/positions', requireAuth, requireAdmin, getGeoVictoriaPositionsController);
geoVictoriaRouter.get('/geovictoria/recibo-employees', requireAuth, requireAdmin, getGeoVictoriaReciboEmployeesController);
geoVictoriaRouter.get('/geovictoria/companies', requireAuth, requireAdmin, getGeoVictoriaCompaniesController);
geoVictoriaRouter.post('/geovictoria/users', requireAuth, requireAdmin, addGeoVictoriaUserController);
geoVictoriaRouter.post('/geovictoria/planning/migrate', requireAuth, requirePlannerWrite, migrateGeoVictoriaPlanningController);
