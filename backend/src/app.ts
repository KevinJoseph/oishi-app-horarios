import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { plannerStateRouter } from './routes/plannerState.routes.js';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { geoVictoriaRouter } from './routes/geovictoria.routes.js';
import { areaRouter } from './routes/area.routes.js';
import { publicScheduleRouter } from './routes/publicSchedule.routes.js';
import { HttpError } from './utils/httpError.js';

export const app = express();

app.use(
  cors({
    origin: env.corsOrigin
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api', authRouter);
app.use('/api', usersRouter);
app.use('/api', plannerStateRouter);
app.use('/api', geoVictoriaRouter);
app.use('/api', areaRouter);
app.use('/api', publicScheduleRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(statusCode).json({ error: message });
});
