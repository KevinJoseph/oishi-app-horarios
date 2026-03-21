import type { Request, Response } from 'express';
import { env } from '../config/env.js';

interface GeoVictoriaUser {
  Id: string;
  Identifier: string;
  Name: string;
  LastName: string;
  Phone: string;
  Email: string;
  GroupDescription: string;
  PositionDescription: string;
  Enabled: string;
  IntegrationCode: string;
  UserProfile: string;
  TradeName: string;
}

interface GeoVictoriaCompanyResponse {
  alias: string;
  name: string;
  ruc: string;
  companyId: string;
}

interface GeoVictoriaAddUserRequestBody {
  Identifier?: string;
  identifier?: string;
  Email?: string;
  email?: string;
  Name?: string;
  name?: string;
  LastName?: string;
  lastName?: string;
  CostCenterCode?: string;
  costCenterCode?: string;
}

function cleanRequiredText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractGeoVictoriaMessage(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return typeof payload === 'string' ? payload : '';
  }

  if ('Message' in payload && typeof payload.Message === 'string') {
    return payload.Message;
  }

  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if ('_message' in payload && typeof payload._message === 'string') {
    return payload._message;
  }

  return '';
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function readJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getTokenForCredentials(cacheKey: string, user: string, password: string, label: string): Promise<string> {
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const response = await fetch(env.geoVictoriaLoginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ User: user, Password: password })
  });

  if (!response.ok) {
    throw new Error(`Error al autenticar con GeoVictoria ${label}: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { token: string };
  if (!data.token) {
    throw new Error(`GeoVictoria ${label} no devolvió un token válido.`);
  }

  const exp = readJwtExp(data.token);
  const expiresAt = exp !== null ? exp - 60_000 : Date.now() + 60 * 60 * 1000;
  tokenCache.set(cacheKey, { token: data.token, expiresAt });
  return data.token;
}

async function getToken(): Promise<string> {
  return getTokenForCredentials('main', env.geoVictoriaUser, env.geoVictoriaPassword, 'principal');
}

async function getReciboToken(): Promise<string> {
  return getTokenForCredentials('recibo', env.geoVictoriaReciboUser, env.geoVictoriaReciboPassword, 'Recibo');
}

function getCompanyCredentials(companyId: string): { companyId: string; user: string; password: string } | null {
  const credentials = env.geoVictoriaCredentialsByCompanyId[companyId];
  return credentials ?? null;
}

export async function getGeoVictoriaReciboEmployeesController(_req: Request, res: Response): Promise<void> {
  if (!env.geoVictoriaReciboUser || !env.geoVictoriaReciboPassword) {
    res.status(503).json({ error: 'Credenciales de GeoVictoria Recibo no configuradas en el servidor.' });
    return;
  }

  let token: string;
  try {
    token = await getReciboToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de autenticación con GeoVictoria Recibo.';
    res.status(502).json({ error: message });
    return;
  }

  const response = await fetch(env.geoVictoriaUserListUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    if (response.status === 401) {
      tokenCache.delete('recibo');
    }
    res.status(502).json({ error: `Error al consultar GeoVictoria Recibo: ${response.status} ${response.statusText}` });
    return;
  }

  const data = (await response.json()) as GeoVictoriaUser[];
  const active = data.filter((user) => user.Enabled === '1');
  res.status(200).json(active);
}

export async function getGeoVictoriaCompaniesController(_req: Request, res: Response): Promise<void> {
  const companies: GeoVictoriaCompanyResponse[] = env.geoVictoriaCompanies.map((company) => ({
    alias: company.alias,
    name: company.name,
    ruc: company.ruc,
    companyId: company.companyId
  }));

  res.status(200).json(companies);
}

export async function getGeoVictoriaEmployeesController(_req: Request, res: Response): Promise<void> {
  if (!env.geoVictoriaUser || !env.geoVictoriaPassword) {
    res.status(503).json({ error: 'Credenciales de GeoVictoria no configuradas en el servidor.' });
    return;
  }

  let token: string;
  try {
    token = await getToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de autenticación con GeoVictoria.';
    res.status(502).json({ error: message });
    return;
  }

  const response = await fetch(env.geoVictoriaUserListUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    // Si el token fue rechazado, limpiar caché para forzar re-login en el próximo intento
    if (response.status === 401) {
      tokenCache.delete('main');
    }
    res.status(502).json({ error: `Error al consultar GeoVictoria: ${response.status} ${response.statusText}` });
    return;
  }

  const data = (await response.json()) as GeoVictoriaUser[];
  const active = data.filter((user) => user.Enabled === '1');
  res.status(200).json(active);
}

export async function addGeoVictoriaUserController(req: Request, res: Response): Promise<void> {
  if (!env.geoVictoriaUser || !env.geoVictoriaPassword) {
    res.status(503).json({ error: 'Credenciales de GeoVictoria no configuradas en el servidor.' });
    return;
  }

  const body = (req.body ?? {}) as GeoVictoriaAddUserRequestBody;
  const identifier = cleanRequiredText(body.Identifier ?? body.identifier);
  const email = cleanRequiredText(body.Email ?? body.email);
  const name = cleanRequiredText(body.Name ?? body.name);
  const lastName = cleanRequiredText(body.LastName ?? body.lastName);
  const costCenterCode = cleanRequiredText(body.CostCenterCode ?? body.costCenterCode);

  if (!identifier || !email || !name || !lastName || !costCenterCode) {
    res.status(400).json({ error: 'Identifier, Email, Name, LastName y CostCenterCode son obligatorios para enviar a GeoVictoria.' });
    return;
  }

  const credentials = getCompanyCredentials(costCenterCode);
  if (!credentials) {
    res.status(400).json({ error: `No existen credenciales configuradas para el CostCenterCode "${costCenterCode}".` });
    return;
  }

  let token: string;
  try {
    token = await getTokenForCredentials(
      `company:${costCenterCode}`,
      credentials.user,
      credentials.password,
      costCenterCode
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de autenticación con GeoVictoria.';
    res.status(502).json({ error: message });
    return;
  }

  const response = await fetch(env.geoVictoriaUserAddUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      Identifier: identifier,
      Email: email,
      Name: name,
      LastName: lastName,
      CostCenterCode: costCenterCode,
      Enabled: '1'
    })
  });

  const rawText = await response.text();
  let parsedBody: unknown = null;
  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText) as unknown;
    } catch {
      parsedBody = rawText;
    }
  }

  if (typeof parsedBody === 'object' && parsedBody !== null && 'Success' in parsedBody && parsedBody.Success === false) {
    res.status(409).json({
      error: extractGeoVictoriaMessage(parsedBody) || 'GeoVictoria rechazó la creación del usuario.'
    });
    return;
  }

  if (!response.ok) {
    if (response.status === 401) {
      tokenCache.delete(`company:${costCenterCode}`);
    }

    res.status(502).json({
      error: extractGeoVictoriaMessage(parsedBody) || `Error al enviar usuario a GeoVictoria: ${response.status} ${response.statusText}`
    });
    return;
  }

  const message = extractGeoVictoriaMessage(parsedBody) || 'Usuario enviado correctamente a GeoVictoria.';

  res.status(200).json({ message });
}
