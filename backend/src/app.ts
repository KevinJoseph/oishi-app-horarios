import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { plannerStateRouter } from './routes/plannerState.routes.js';
import { env } from './config/env.js';

export const app = express();

app.use(
  cors({
    origin: env.corsOrigin
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api', plannerStateRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ error: message });
});
