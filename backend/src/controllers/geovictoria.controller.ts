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
  groups: typeof env.geoVictoriaReciboGroups;
}

interface GeoVictoriaAddUserRequestBody {
  CompanyId?: string;
  companyId?: string;
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

interface GeoVictoriaMigrateShiftItemRequestBody {
  assignmentType?: string;
  employeeId?: string;
  employeeName?: string;
  companyId?: string;
  userIdentifier?: string;
  dateISO?: string;
  startHour?: string;
  endHour?: string;
  breakStartHour?: string;
  breakEndHour?: string;
  custom?: string;
}

interface GeoVictoriaMigratePlanningRequestBody {
  items?: GeoVictoriaMigrateShiftItemRequestBody[];
}

interface GeoVictoriaShiftListItem {
  id: string;
  type: string;
  shiftDisplay: string;
  startTime: string;
  exitTime: string;
  breakStart: string;
  breakEnd: string;
  breakMinutes: string;
  custom: string;
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

function formatGeoVictoriaDate(dateISO: string): string {
  return `${dateISO.replace(/-/g, '')}000000`;
}

function isValidHour(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value);
}

function isValidDateISO(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toMinutes(value: string): number | null {
  if (!isValidHour(value)) return null;
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function normalizeShiftTime(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '00:00';
}

function normalizeGeoVictoriaShiftListItem(item: unknown): GeoVictoriaShiftListItem | null {
  if (!item || typeof item !== 'object') return null;

  const source = item as Record<string, unknown>;
  const id = cleanRequiredText(source.Id ?? source.id);
  if (!id) return null;

  return {
    id,
    type: cleanRequiredText(source.Type ?? source.type),
    shiftDisplay: cleanRequiredText(source.ShiftDisplay ?? source.shiftDisplay),
    startTime: normalizeShiftTime(source.StartTime ?? source.startTime),
    exitTime: normalizeShiftTime(source.ExitTime ?? source.exitTime),
    breakStart: normalizeShiftTime(source.BreakStart ?? source.breakStart),
    breakEnd: normalizeShiftTime(source.BreakEnd ?? source.breakEnd),
    breakMinutes: cleanRequiredText(source.BreakMinutes ?? source.breakMinutes),
    custom: cleanRequiredText(source.Custom ?? source.custom)
  };
}

function findGeoVictoriaRestShift(shifts: GeoVictoriaShiftListItem[]): GeoVictoriaShiftListItem | null {
  return (
    shifts.find((shift) => {
      const type = shift.type.toLowerCase();
      const display = shift.shiftDisplay.toLowerCase();
      return (
        (type === 'notworking' && display === 'descanso') ||
        (type === 'notworking' && display === 'break')
      );
    }) ?? null
  );
}

function findGeoVictoriaFreeShift(shifts: GeoVictoriaShiftListItem[]): GeoVictoriaShiftListItem | null {
  return (
    shifts.find((shift) => {
      const type = shift.type.toLowerCase();
      const display = shift.shiftDisplay.toLowerCase();
      return type === 'noshift' && display === 'no shift';
    }) ?? null
  );
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

async function insertGeoVictoriaShift(
  token: string,
  tokenCacheKey: string,
  startHour: string,
  endHour: string,
  breakStartHour: string | undefined,
  breakEndHour: string | undefined,
  custom: string
): Promise<string> {
  const payload: Record<string, string> = {
    StartHour: startHour,
    EndHour: endHour,
    ShiftDay: 'fin',
    Custom: custom
  };

  if (breakStartHour && breakEndHour) {
    payload.BreakStart = breakStartHour;
    payload.BreakEnd = breakEndHour;
  }

  const response = await fetch(env.geoVictoriaShiftInsertUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 401) {
      tokenCache.delete(tokenCacheKey);
    }
    throw new Error(`Error al crear turno en GeoVictoria: ${response.status} ${response.statusText}`);
  }

  const rawText = (await response.text()).trim();
  if (!rawText) {
    throw new Error('GeoVictoria no devolvio el identificador del turno.');
  }

  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (typeof parsed === 'string' && parsed.trim()) {
      return parsed.trim();
    }
  } catch {
    // La API tambien puede responder en texto plano.
  }

  return rawText.replace(/^"|"$/g, '');
}

async function listGeoVictoriaShifts(token: string, tokenCacheKey: string): Promise<GeoVictoriaShiftListItem[]> {
  const response = await fetch(env.geoVictoriaShiftListUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    if (response.status === 401) {
      tokenCache.delete(tokenCacheKey);
    }
    throw new Error(`Error al listar turnos en GeoVictoria: ${response.status} ${response.statusText}`);
  }

  const parsed = (await response.json()) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((item) => normalizeGeoVictoriaShiftListItem(item)).filter((item): item is GeoVictoriaShiftListItem => item !== null);
}

function findMatchingGeoVictoriaShift(
  shifts: GeoVictoriaShiftListItem[],
  startHour: string,
  endHour: string,
  breakStartHour?: string,
  breakEndHour?: string
): GeoVictoriaShiftListItem | null {
  return (
    shifts.find((shift) => {
      const hasNoBreak =
        (!shift.breakMinutes || shift.breakMinutes === '0') &&
        (!shift.breakStart || shift.breakStart === '00:00') &&
        (!shift.breakEnd || shift.breakEnd === '00:00');

      const hasMatchingFixedBreak =
        Boolean(breakStartHour && breakEndHour) &&
        shift.breakStart === breakStartHour &&
        shift.breakEnd === breakEndHour &&
        (!shift.breakMinutes || shift.breakMinutes === '0');

      return (
        shift.startTime === startHour &&
        shift.exitTime === endHour &&
        ((breakStartHour && breakEndHour ? hasMatchingFixedBreak : hasNoBreak))
      );
    }) ?? null
  );
}

async function assignGeoVictoriaPlanning(
  token: string,
  tokenCacheKey: string,
  userIdentifier: string,
  shiftId: string,
  dateISO: string
): Promise<string> {
  const response = await fetch(env.geoVictoriaPlanningUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([
      {
        User: userIdentifier,
        Shift: [
          {
            ShiftId: shiftId,
            Date: formatGeoVictoriaDate(dateISO)
          }
        ]
      }
    ])
  });

  const rawText = (await response.text()).trim();
  if (!response.ok) {
    if (response.status === 401) {
      tokenCache.delete(tokenCacheKey);
    }
    throw new Error(`Error al asignar planificacion en GeoVictoria: ${response.status} ${response.statusText}`);
  }

  if (!rawText) {
    return 'OK';
  }

  try {
    const parsed = JSON.parse(rawText) as unknown;
    return extractGeoVictoriaMessage(parsed) || rawText;
  } catch {
    return rawText;
  }
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
    companyId: company.companyId,
    groups: company.alias.toUpperCase() === 'RECIBO' ? env.geoVictoriaReciboGroups : []
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
  const body = (req.body ?? {}) as GeoVictoriaAddUserRequestBody;
  const companyId = cleanRequiredText(body.CompanyId ?? body.companyId);
  const identifier = cleanRequiredText(body.Identifier ?? body.identifier);
  const email = cleanRequiredText(body.Email ?? body.email);
  const name = cleanRequiredText(body.Name ?? body.name);
  const lastName = cleanRequiredText(body.LastName ?? body.lastName);
  const costCenterCode = cleanRequiredText(body.CostCenterCode ?? body.costCenterCode);

  if (!companyId || !identifier || !email || !name || !lastName || !costCenterCode) {
    res
      .status(400)
      .json({ error: 'CompanyId, Identifier, Email, Name, LastName y CostCenterCode son obligatorios para enviar a GeoVictoria.' });
    return;
  }

  const credentials = getCompanyCredentials(companyId);
  if (!credentials) {
    res.status(400).json({ error: `No existen credenciales configuradas para la company "${companyId}".` });
    return;
  }

  let token: string;
  try {
    token = await getTokenForCredentials(
      `company:${companyId}`,
      credentials.user,
      credentials.password,
      companyId
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
      tokenCache.delete(`company:${companyId}`);
    }

    res.status(502).json({
      error: extractGeoVictoriaMessage(parsedBody) || `Error al enviar usuario a GeoVictoria: ${response.status} ${response.statusText}`
    });
    return;
  }

  const message = extractGeoVictoriaMessage(parsedBody) || 'Usuario enviado correctamente a GeoVictoria.';

  res.status(200).json({ message });
}

export async function migrateGeoVictoriaPlanningController(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as GeoVictoriaMigratePlanningRequestBody;
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    res.status(400).json({ error: 'Debes enviar al menos un turno para migrar.' });
    return;
  }

  const shiftIdCache = new Map<string, string>();
  const shiftsByCompanyId = new Map<string, GeoVictoriaShiftListItem[]>();
  const preclearedDays = new Set<string>();
  const results: Array<{
    assignmentType: 'work' | 'rest' | 'free';
    employeeId: string;
    employeeName: string;
    userIdentifier: string;
    companyId: string;
    dateISO: string;
    startHour: string;
    endHour: string;
    breakStartHour?: string;
    breakEndHour?: string;
    ok: boolean;
    shiftId?: string;
    shiftSource?: 'existing' | 'created';
    shiftOk?: boolean;
    shiftMessage?: string;
    planningOk?: boolean;
    planningResponse?: string;
    planningMessage?: string;
    error?: string;
  }> = [];

  for (const item of items) {
    const rawAssignmentType = cleanRequiredText(item.assignmentType).toLowerCase();
    const assignmentType = rawAssignmentType === 'rest' ? 'rest' : rawAssignmentType === 'free' ? 'free' : 'work';
    const employeeId = cleanRequiredText(item.employeeId);
    const employeeName = cleanRequiredText(item.employeeName);
    const companyId = cleanRequiredText(item.companyId);
    const userIdentifier = cleanRequiredText(item.userIdentifier);
    const dateISO = cleanRequiredText(item.dateISO);
    const startHour = cleanRequiredText(item.startHour);
    const endHour = cleanRequiredText(item.endHour);
    const breakStartHour = cleanRequiredText(item.breakStartHour);
    const breakEndHour = cleanRequiredText(item.breakEndHour);
    const custom = (cleanRequiredText(item.custom) || `${startHour}-${endHour}`).slice(0, 20);
    const startMinutes = toMinutes(startHour);
    const endMinutes = toMinutes(endHour);
    const breakStartMinutes = breakStartHour ? toMinutes(breakStartHour) : null;
    const breakEndMinutes = breakEndHour ? toMinutes(breakEndHour) : null;
    const hasFixedBreak = Boolean(breakStartHour || breakEndHour);
    const breakIsValid =
      !hasFixedBreak ||
      (breakStartMinutes !== null &&
        breakEndMinutes !== null &&
        breakEndMinutes > breakStartMinutes &&
        startMinutes !== null &&
        endMinutes !== null &&
        breakStartMinutes >= startMinutes &&
        breakEndMinutes <= endMinutes);

    if (
      !employeeId ||
      !employeeName ||
      !companyId ||
      !userIdentifier ||
      !isValidDateISO(dateISO) ||
      (assignmentType === 'work' && (startMinutes === null || endMinutes === null || endMinutes <= startMinutes)) ||
      !breakIsValid
    ) {
      results.push({
        assignmentType,
        employeeId,
        employeeName,
        userIdentifier,
        companyId,
        dateISO,
        startHour,
        endHour,
        breakStartHour: breakStartHour || undefined,
        breakEndHour: breakEndHour || undefined,
        ok: false,
        error: 'Fila invalida. Verifica company, identificador, fecha y horas.'
      });
      continue;
    }

    const credentials = getCompanyCredentials(companyId);
    if (!credentials) {
      results.push({
        assignmentType,
        employeeId,
        employeeName,
        userIdentifier,
        companyId,
        dateISO,
        startHour,
        endHour,
        breakStartHour: breakStartHour || undefined,
        breakEndHour: breakEndHour || undefined,
        ok: false,
        error: `No existen credenciales configuradas para la company "${companyId}".`
      });
      continue;
    }

    const tokenCacheKey = `company:${companyId}`;
    let shiftId: string | undefined;
    let shiftSource: 'existing' | 'created' | undefined;
    let shiftMessage = '';

    try {
      const token = await getTokenForCredentials(tokenCacheKey, credentials.user, credentials.password, companyId);
      let companyShifts = shiftsByCompanyId.get(companyId);
      if (!companyShifts) {
        companyShifts = await listGeoVictoriaShifts(token, tokenCacheKey);
        shiftsByCompanyId.set(companyId, companyShifts);
      }

      const dayResetKey = `${companyId}|${userIdentifier}|${dateISO}`;
      if (!preclearedDays.has(dayResetKey)) {
        let freeShiftId = shiftIdCache.get(`${companyId}|free`);
        if (!freeShiftId) {
          const freeShift = findGeoVictoriaFreeShift(companyShifts);
          if (!freeShift) {
            throw new Error('No existe un turno "NoShift / No Shift" configurado en GeoVictoria para limpiar el día antes de migrar.');
          }
          freeShiftId = freeShift.id;
          shiftIdCache.set(`${companyId}|free`, freeShiftId);
        }

        await assignGeoVictoriaPlanning(token, tokenCacheKey, userIdentifier, freeShiftId, dateISO);
        preclearedDays.add(dayResetKey);
      }

      const shiftSignature =
        assignmentType === 'rest'
          ? `${companyId}|rest`
          : assignmentType === 'free'
            ? `${companyId}|free`
            : `${companyId}|${startHour}|${endHour}|${breakStartHour}|${breakEndHour}`;
      shiftId = shiftIdCache.get(shiftSignature);
      shiftSource = 'created';

      if (!shiftId) {
        const existingShift =
          assignmentType === 'rest'
            ? findGeoVictoriaRestShift(companyShifts)
            : assignmentType === 'free'
              ? findGeoVictoriaFreeShift(companyShifts)
            : findMatchingGeoVictoriaShift(companyShifts, startHour, endHour, breakStartHour || undefined, breakEndHour || undefined);
        if (existingShift) {
          shiftId = existingShift.id;
          shiftSource = 'existing';
          shiftMessage = `Se reutilizo el turno existente ${shiftId}.`;
        } else {
          if (assignmentType === 'rest') {
            throw new Error('No existe un turno de descanso configurado en GeoVictoria para registrar descansos.');
          }
          if (assignmentType === 'free') {
            throw new Error('No existe un turno "NoShift / No Shift" configurado en GeoVictoria para registrar SIN ASIGNAR.');
          }
          shiftId = await insertGeoVictoriaShift(
            token,
            tokenCacheKey,
            startHour,
            endHour,
            breakStartHour || undefined,
            breakEndHour || undefined,
            custom
          );
          companyShifts.push({
            id: shiftId,
            type: '',
            shiftDisplay: '',
            startTime: startHour,
            exitTime: endHour,
            breakStart: breakStartHour || '00:00',
            breakEnd: breakEndHour || '00:00',
            breakMinutes: '',
            custom
          });
          shiftSource = 'created';
          shiftMessage = `Se creo el turno ${shiftId}.`;
        }
        shiftIdCache.set(shiftSignature, shiftId);
      } else {
        shiftSource = 'existing';
        shiftMessage = `Se reutilizo el turno ${shiftId} desde cache de la migracion actual.`;
      }

      if (assignmentType === 'free') {
        results.push({
          assignmentType,
          employeeId,
          employeeName,
          userIdentifier,
          companyId,
          dateISO,
          startHour,
          endHour,
          breakStartHour: breakStartHour || undefined,
          breakEndHour: breakEndHour || undefined,
          ok: true,
          shiftId,
          shiftSource,
          shiftOk: true,
          shiftMessage: shiftMessage || `Se dejo el dia ${dateISO} sin turno en GeoVictoria.`,
          planningOk: true,
          planningResponse: 'OK',
          planningMessage: 'Dia limpiado y dejado sin turno.'
        });
        continue;
      }

      const planningResponse = await assignGeoVictoriaPlanning(token, tokenCacheKey, userIdentifier, shiftId, dateISO);
      results.push({
        assignmentType,
        employeeId,
        employeeName,
        userIdentifier,
        companyId,
        dateISO,
        startHour,
        endHour,
        breakStartHour: breakStartHour || undefined,
        breakEndHour: breakEndHour || undefined,
        ok: true,
        shiftId,
        shiftSource,
        shiftOk: true,
        shiftMessage,
        planningOk: true,
        planningResponse,
        planningMessage: planningResponse || 'Planificacion creada correctamente.'
      });
    } catch (error) {
      results.push({
        assignmentType,
        employeeId,
        employeeName,
        userIdentifier,
        companyId,
        dateISO,
        startHour,
        endHour,
        breakStartHour: breakStartHour || undefined,
        breakEndHour: breakEndHour || undefined,
        ok: false,
        shiftId,
        shiftSource,
        shiftOk: Boolean(shiftId),
        shiftMessage: shiftMessage || undefined,
        planningOk: false,
        error: error instanceof Error ? error.message : 'Error al migrar turno a GeoVictoria.'
      });
    }
  }

  const migrated = results.filter((item) => item.ok).length;
  const failed = results.length - migrated;
  res.status(200).json({ migrated, failed, results });
}
