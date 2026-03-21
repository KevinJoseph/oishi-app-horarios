import dotenv from 'dotenv';

dotenv.config();

type GeoVictoriaCompany = {
  alias: string;
  name: string;
  ruc: string;
  companyId: string;
};

type GeoVictoriaCredential = {
  companyId: string;
  user: string;
  password: string;
};

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseGeoVictoriaCompanies(): GeoVictoriaCompany[] {
  const raw = process.env.GEOVICTORIA_COMPANIES?.trim() ?? '[]';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Formato inválido.';
    throw new Error(`GEOVICTORIA_COMPANIES no tiene un JSON válido: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('GEOVICTORIA_COMPANIES debe ser un arreglo JSON.');
  }

  return parsed.map((company, index) => {
    if (
      !company ||
      typeof company !== 'object' ||
      typeof company.alias !== 'string' ||
      typeof company.name !== 'string' ||
      typeof company.ruc !== 'string' ||
      typeof company.companyId !== 'string'
    ) {
      throw new Error(`GEOVICTORIA_COMPANIES tiene una empresa inválida en la posición ${index}.`);
    }

    return {
      alias: company.alias.trim(),
      name: company.name.trim(),
      ruc: company.ruc.trim(),
      companyId: company.companyId.trim()
    };
  });
}

function normalizeCompanyAliasKey(alias: string): string {
  return alias
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function parseGeoVictoriaCredentialsByCompanyId(companies: GeoVictoriaCompany[]): Record<string, GeoVictoriaCredential> {
  const credentials: Record<string, GeoVictoriaCredential> = {};

  for (const company of companies) {
    const aliasKey = normalizeCompanyAliasKey(company.alias);
    const idEnvName = `GEOVICTORIA_${aliasKey}_ID`;
    const userEnvName = `GEOVICTORIA_${aliasKey}_USER`;
    const passwordEnvName = `GEOVICTORIA_${aliasKey}_PASSWORD`;
    const configuredCompanyId = process.env[idEnvName]?.trim().replace(/^"|"$/g, '') ?? '';
    const user = process.env[userEnvName]?.trim() ?? '';
    const password = process.env[passwordEnvName]?.trim() ?? '';

    if (!configuredCompanyId || !user || !password) {
      throw new Error(`Faltan credenciales para la company "${company.alias}": ${idEnvName}/${userEnvName}/${passwordEnvName}.`);
    }

    if (configuredCompanyId !== company.companyId) {
      throw new Error(
        `El ID configurado para "${company.alias}" en ${idEnvName} no coincide con GEOVICTORIA_COMPANIES.`
      );
    }

    credentials[company.companyId] = {
      companyId: configuredCompanyId,
      user,
      password
    };
  }

  return credentials;
}

const geoVictoriaCompanies = parseGeoVictoriaCompanies();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: requireEnv('MONGO_URI', 'mongodb://127.0.0.1:27017/app_horarios2'),
  corsOrigin: requireEnv('CORS_ORIGIN', 'http://localhost:5173'),
  authSessionDays: Number(process.env.AUTH_SESSION_DAYS ?? 7),
  defaultAdminUsername: requireEnv('DEFAULT_ADMIN_USERNAME', 'Administrador'),
  defaultAdminPassword: requireEnv('DEFAULT_ADMIN_PASSWORD', 'Admin@@1##'),
  defaultAdminName: requireEnv('DEFAULT_ADMIN_NAME', 'Administrador'),
  geoVictoriaLoginUrl: requireEnv('GEOVICTORIA_LOGIN_URL', 'https://customerapi.geovictoria.com/api/v1/Login'),
  geoVictoriaUserListUrl: requireEnv('GEOVICTORIA_USER_LIST_URL', 'https://customerapi.geovictoria.com/api/v1/User/ListComplete'),
  geoVictoriaUserAddUrl: requireEnv('GEOVICTORIA_USER_ADD_URL', 'https://customerapi.geovictoria.com/api/v1/User/Add'),
  geoVictoriaUser: process.env.GEOVICTORIA_CANETE_USER ?? '',
  geoVictoriaPassword: process.env.GEOVICTORIA_CANETE_PASSWORD ?? '',
  geoVictoriaReciboUser: process.env.GEOVICTORIA_RECIBO_USER ?? '',
  geoVictoriaReciboPassword: process.env.GEOVICTORIA_RECIBO_PASSWORD ?? '',
  geoVictoriaCompanies,
  geoVictoriaCredentialsByCompanyId: parseGeoVictoriaCredentialsByCompanyId(geoVictoriaCompanies)
};
