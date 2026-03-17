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

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

function readJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const response = await fetch(env.geoVictoriaLoginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ User: env.geoVictoriaUser, Password: env.geoVictoriaPassword })
  });

  if (!response.ok) {
    throw new Error(`Error al autenticar con GeoVictoria: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { token: string };
  if (!data.token) {
    throw new Error('GeoVictoria no devolvió un token válido.');
  }

  const exp = readJwtExp(data.token);
  // Usar el exp del JWT con 1 minuto de margen; si no se puede leer, caché de 1 hora
  tokenExpiresAt = exp !== null ? exp - 60_000 : Date.now() + 60 * 60 * 1000;
  cachedToken = data.token;
  return cachedToken;
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

  const response = await fetch(env.geoVictoriaApiUrl, {
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
      cachedToken = null;
      tokenExpiresAt = 0;
    }
    res.status(502).json({ error: `Error al consultar GeoVictoria: ${response.status} ${response.statusText}` });
    return;
  }

  const data = (await response.json()) as GeoVictoriaUser[];
  const active = data.filter((user) => user.Enabled === '1');
  res.status(200).json(active);
}
