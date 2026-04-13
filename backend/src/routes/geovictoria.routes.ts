import { Router } from 'express';
import {
  addGeoVictoriaUserController,
  getGeoVictoriaCompaniesController,
  getGeoVictoriaEmployeesController,
  getGeoVictoriaPositionsController,
  getGeoVictoriaReciboEmployeesController,
  migrateGeoVictoriaPlanningController,
  saveMigrationLogsController,
  getMigrationLogsController
} from '../controllers/geovictoria.controller.js';
import { requireAdmin, requireAuth, requirePlannerWrite } from '../middlewares/auth.middleware.js';

export const geoVictoriaRouter = Router();

geoVictoriaRouter.get('/geovictoria/employees', requireAuth, requirePlannerWrite, getGeoVictoriaEmployeesController);
geoVictoriaRouter.get('/geovictoria/positions', requireAuth, requirePlannerWrite, getGeoVictoriaPositionsController);
geoVictoriaRouter.get('/geovictoria/recibo-employees', requireAuth, requireAdmin, getGeoVictoriaReciboEmployeesController);
geoVictoriaRouter.get('/geovictoria/companies', requireAuth, getGeoVictoriaCompaniesController);
geoVictoriaRouter.post('/geovictoria/users', requireAuth, requirePlannerWrite, addGeoVictoriaUserController);
geoVictoriaRouter.post('/geovictoria/planning/migrate', requireAuth, requirePlannerWrite, migrateGeoVictoriaPlanningController);
geoVictoriaRouter.post('/geovictoria/migration-logs', requireAuth, requirePlannerWrite, saveMigrationLogsController);
geoVictoriaRouter.get('/geovictoria/migration-logs', requireAuth, getMigrationLogsController);
