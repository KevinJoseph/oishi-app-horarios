import { Router } from 'express';
import { getPublicEmployeeScheduleController } from '../controllers/publicSchedule.controller.js';
export const publicScheduleRouter = Router();
publicScheduleRouter.get('/public/employee-schedule/:employeeId', getPublicEmployeeScheduleController);
