import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: requireEnv('MONGO_URI', 'mongodb://127.0.0.1:27017/app_horarios2'),
  corsOrigin: requireEnv('CORS_ORIGIN', 'http://localhost:5173')
};
