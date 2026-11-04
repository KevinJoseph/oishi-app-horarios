import { Router } from 'express';
import { listEmployeeDirectory } from '../services/employeeDirectory.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const employeeDirectoryRouter = Router();

employeeDirectoryRouter.get('/employees/directory', requireAuth, async (_req, res, next) => {
  try {
    res.status(200).json(await listEmployeeDirectory());
  } catch (error) {
    next(error);
  }
});
