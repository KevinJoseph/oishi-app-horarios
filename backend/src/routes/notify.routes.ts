import { Router } from 'express';
import { notifyEmailScheduleController, notifyWhatsappScheduleController } from '../controllers/notify.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const notifyRouter = Router();

notifyRouter.post('/notify/whatsapp-schedule', requireAuth, notifyWhatsappScheduleController);
notifyRouter.post('/notify/email-schedule', requireAuth, notifyEmailScheduleController);
