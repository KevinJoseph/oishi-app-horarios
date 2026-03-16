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

export async function getGeoVictoriaEmployeesController(_req: Request, res: Response): Promise<void> {
  if (!env.geoVictoriaToken) {
    res.status(503).json({ error: 'Token de GeoVictoria no configurado en el servidor.' });
    return;
  }

  const response = await fetch(env.geoVictoriaApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.geoVictoriaToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    res.status(502).json({ error: `Error al consultar GeoVictoria: ${response.status} ${response.statusText}` });
    return;
  }

  const data = (await response.json()) as GeoVictoriaUser[];
  const active = data.filter((user) => user.Enabled === '1');
  res.status(200).json(active);
}
