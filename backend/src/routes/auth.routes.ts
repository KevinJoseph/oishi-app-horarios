import { Router } from 'express';
import { loginController, logoutController, meController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/auth/login', loginController);
authRouter.get('/auth/me', requireAuth, meController);
authRouter.post('/auth/logout', requireAuth, logoutController);
