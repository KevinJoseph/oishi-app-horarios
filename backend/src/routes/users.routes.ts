import { Router } from 'express';
import {
  createUserController,
  deleteUserController,
  listUsersController,
  updateUserController
} from '../controllers/users.controller.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.middleware.js';

export const usersRouter = Router();

usersRouter.get('/users', requireAuth, listUsersController);
usersRouter.post('/users', requireAuth, requireAdmin, createUserController);
usersRouter.put('/users/:id', requireAuth, requireAdmin, updateUserController);
usersRouter.delete('/users/:id', requireAuth, requireAdmin, deleteUserController);
