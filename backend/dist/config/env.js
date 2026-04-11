import dotenv from 'dotenv';
dotenv.config();
function requireEnv(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function requireTrimmedEnv(name, fallback) {
    return requireEnv(name, fallback).trim().replace(/^"|"$/g, '');
}
function parseGeoVictoriaActiveCompanyKeys() {
    const raw = requireTrimmedEnv('GEOVICTORIA_ACTIVE_COMPANIES', 'CANETE,RECIBO,CHINCHA,ICA,LINAJE,COMPANY');
    const keys = raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.toUpperCase());
    if (keys.length === 0) {
        throw new Error('GEOVICTORIA_ACTIVE_COMPANIES debe incluir al menos una empresa.');
    }
    return [...new Set(keys)];
}
function formatCompanyAlias(envKey) {
    return envKey
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
function parseGeoVictoriaCompanies() {
    return parseGeoVictoriaActiveCompanyKeys().map((envKey) => ({
        envKey,
        alias: process.env[`GEOVICTORIA_${envKey}_ALIAS`]?.trim() || formatCompanyAlias(envKey),
        name: requireTrimmedEnv(`GEOVICTORIA_${envKey}_NAME`),
        ruc: requireTrimmedEnv(`GEOVICTORIA_${envKey}_RUC`),
        companyId: requireTrimmedEnv(`GEOVICTORIA_${envKey}_ID`)
    }));
}
function parseGeoVictoriaGroups(envName) {
    const raw = process.env[envName]?.trim() ?? '[]';
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Formato invalido.';
        throw new Error(`${envName} no tiene un JSON valido: ${message}`);
    }
    if (!Array.isArray(parsed)) {
        throw new Error(`${envName} debe ser un arreglo JSON.`);
    }
    return parsed.map((group, index) => {
        if (!group ||
            typeof group !== 'object' ||
            typeof group.name !== 'string' ||
            typeof group.code_centro_costo !== 'string') {
            throw new Error(`${envName} tiene un grupo invalido en la posicion ${index}.`);
        }
        return {
            name: group.name.trim(),
            code_centro_costo: group.code_centro_costo.trim()
        };
    });
}
function normalizeCompanyAliasKey(alias) {
    return alias
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
}
function parseGeoVictoriaCredentialsByCompanyId(companies) {
    const credentials = {};
    for (const company of companies) {
        const aliasKey = normalizeCompanyAliasKey(company.envKey);
        const userEnvName = `GEOVICTORIA_${aliasKey}_USER`;
        const passwordEnvName = `GEOVICTORIA_${aliasKey}_PASSWORD`;
        const user = process.env[userEnvName]?.trim() ?? '';
        const password = process.env[passwordEnvName]?.trim() ?? '';
        if (!user || !password) {
            throw new Error(`Faltan credenciales para la company "${company.alias}": ${userEnvName}/${passwordEnvName}.`);
        }
        credentials[company.companyId] = {
            companyId: company.companyId,
            user,
            password
        };
    }
    return credentials;
}
const geoVictoriaCompanies = parseGeoVictoriaCompanies();
const geoVictoriaReciboGroups = parseGeoVictoriaGroups('GEOVICTORIA_RECIBO_GROUPS');
export const env = {
    port: Number(process.env.PORT ?? 4000),
    mongoUri: requireEnv('MONGO_URI', 'mongodb://127.0.0.1:27017/app_horarios2'),
    corsOrigin: requireEnv('CORS_ORIGIN', 'http://localhost:5173'),
    authSessionDays: Number(process.env.AUTH_SESSION_DAYS ?? 7),
    authPasswordResetMinutes: Number(process.env.AUTH_PASSWORD_RESET_MINUTES ?? 30),
    authJwtSecret: requireEnv('AUTH_JWT_SECRET', 'dev-jwt-secret-change-me'),
    defaultAdminUsername: requireEnv('DEFAULT_ADMIN_USERNAME', 'Administrador'),
    defaultAdminPassword: requireEnv('DEFAULT_ADMIN_PASSWORD', 'Admin@@1##'),
    defaultAdminName: requireEnv('DEFAULT_ADMIN_NAME', 'Administrador'),
    geoVictoriaLoginUrl: requireEnv('GEOVICTORIA_LOGIN_URL', 'https://customerapi.geovictoria.com/api/v1/Login'),
    geoVictoriaUserListUrl: requireEnv('GEOVICTORIA_USER_LIST_URL', 'https://customerapi.geovictoria.com/api/v1/User/ListComplete'),
    geoVictoriaUserAddUrl: requireEnv('GEOVICTORIA_USER_ADD_URL', 'https://customerapi.geovictoria.com/api/v1/User/Add'),
    geoVictoriaUserEditUrl: requireEnv('GEOVICTORIA_USER_EDIT_URL', 'https://customerapi.geovictoria.com/api/v1/User/Edit'),
    geoVictoriaPositionListUrl: requireEnv('GEOVICTORIA_POSITION_LIST_URL', 'https://customerapi.geovictoria.com/api/v1/Position/List'),
    geoVictoriaShiftListUrl: requireEnv('GEOVICTORIA_SHIFT_LIST_URL', 'https://customerapi.geovictoria.com/api/v1/Shift/List'),
    geoVictoriaShiftInsertUrl: requireEnv('GEOVICTORIA_SHIFT_INSERT_URL', 'https://customerapi.geovictoria.com/api/v1/Shift/Insert'),
    geoVictoriaPlanningUrl: requireEnv('GEOVICTORIA_PLANNING_URL', 'https://customerapi.geovictoria.com/api/v1/Planning'),
    geoVictoriaUser: process.env.GEOVICTORIA_CANETE_USER ?? '',
    geoVictoriaPassword: process.env.GEOVICTORIA_CANETE_PASSWORD ?? '',
    geoVictoriaReciboUser: process.env.GEOVICTORIA_RECIBO_USER ?? '',
    geoVictoriaReciboPassword: process.env.GEOVICTORIA_RECIBO_PASSWORD ?? '',
    geoVictoriaReciboGroups,
    geoVictoriaCompanies,
    geoVictoriaCredentialsByCompanyId: parseGeoVictoriaCredentialsByCompanyId(geoVictoriaCompanies)
};
