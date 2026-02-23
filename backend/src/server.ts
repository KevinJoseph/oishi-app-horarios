import { app } from './app.js';
import { connectToDatabase } from './config/db.js';
import { env } from './config/env.js';
import { ensureDefaultAdminUser } from './services/user.service.js';

async function startServer(): Promise<void> {
  await connectToDatabase(env.mongoUri);
  await ensureDefaultAdminUser();

  app.listen(env.port, () => {
    console.log(`Backend listening on http://localhost:${env.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
