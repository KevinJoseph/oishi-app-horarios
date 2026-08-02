import { Router } from 'express';
import { notifyWhatsappScheduleController } from '../controllers/notify.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
export const notifyRouter = Router();
notifyRouter.post('/notify/whatsapp-schedule', requireAuth, notifyWhatsappScheduleController);
