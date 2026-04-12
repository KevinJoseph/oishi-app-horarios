import { Router } from 'express';
import {
  adminResetPasswordController,
  changePasswordController,
  forgotPasswordController,
  loginController,
  logoutController,
  meController,
  resetPasswordController
} from '../controllers/auth.controller.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/auth/login', loginController);
authRouter.get('/auth/me', requireAuth, meController);
authRouter.post('/auth/logout', requireAuth, logoutController);
authRouter.post('/auth/change-password', requireAuth, changePasswordController);
authRouter.post('/auth/forgot-password', forgotPasswordController);
authRouter.post('/auth/reset-password', resetPasswordController);
authRouter.put('/auth/admin-reset-password', requireAuth, requireAdmin, adminResetPasswordController);
