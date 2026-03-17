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
  corsOrigin: requireEnv('CORS_ORIGIN', 'http://localhost:5173'),
  authSessionDays: Number(process.env.AUTH_SESSION_DAYS ?? 7),
  defaultAdminUsername: requireEnv('DEFAULT_ADMIN_USERNAME', 'Administrador'),
  defaultAdminPassword: requireEnv('DEFAULT_ADMIN_PASSWORD', 'Admin@@1##'),
  defaultAdminName: requireEnv('DEFAULT_ADMIN_NAME', 'Administrador'),
  geoVictoriaLoginUrl: requireEnv('GEOVICTORIA_LOGIN_URL', 'https://customerapi.geovictoria.com/api/v1/Login'),
  geoVictoriaApiUrl: requireEnv('GEOVICTORIA_API_URL', 'https://customerapi.geovictoria.com/api/v1/User/ListComplete'),
  geoVictoriaUser: process.env.GEOVICTORIA_USER ?? '',
  geoVictoriaPassword: process.env.GEOVICTORIA_PASSWORD ?? ''
};
