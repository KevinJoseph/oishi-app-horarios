import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { isSuperAdmin } from '../middlewares/auth.middleware.js';
import { MigrationLogModel } from '../models/MigrationLog.js';

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

interface GeoVictoriaPosition {
  Identifier: string;
  PositionDescription: string;
  PositionState: string;
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
  PositionDescription?: string;
  positionDescription?: string;
}

interface GeoVictoriaMigrateShiftItemRequestBody {
  assignmentType?: string;
  employeeId?: string;
  employeeName?: string;
  companyId?: string;
  companyAlias?: string;
  userIdentifier?: string;
  costCenterCode?: string;
  dateISO?: string;
  startHour?: string;
  endHour?: string;
  breakStartHour?: string;
  breakEndHour?: string;
  custom?: string;
  crossesMidnight?: boolean;
}

interface GeoVictoriaMigratePlanningRequestBody {
  items?: GeoVictoriaMigrateShiftItemRequestBody[];
}

interface GeoVictoriaOvertimeItemRequestBody {
  employeeId?: string;
  employeeName?: string;
  companyId?: string;
  companyAlias?: string;
  userIdentifier?: string;
  dateISO?: string;
  durationBefore?: string;
  durationAfter?: string;
  valueBefore?: string;
  valueAfter?: string;
}

interface GeoVictoriaOvertimeRequestBody {
  items?: GeoVictoriaOvertimeItemRequestBody[];
}

interface GeoVictoriaOvertimeClearItemRequestBody {
  employeeId?: string;
  employeeName?: string;
  companyId?: string;
  companyAlias?: string;
  userIdentifier?: string;
  dateISO?: string;
  durationBefore?: string;
  durationAfter?: string;
}

interface GeoVictoriaOvertimeClearRequestBody {
  items?: GeoVictoriaOvertimeClearItemRequestBody[];
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

// GeoVictoria a veces responde HTTP 200 pero con un cuerpo que en realidad
// indica un fallo (ej. {"Code":"0066","CategoryException":"NonExistenceOfData",
// "Description":"Desactivated or inexistent users detected: ..."}). Detectamos
// esos casos para no marcar la planificacion como exitosa cuando no lo es.
function extractGeoVictoriaErrorInBody(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return /desactivated|inexistent|no existe|error|exception/i.test(payload) ? payload : null;
  }
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const code = typeof record.Code === 'string' ? record.Code : '';
  const category = typeof record.CategoryException === 'string' ? record.CategoryException : '';
  const description = typeof record.Description === 'string' ? record.Description : '';
  const message = extractGeoVictoriaMessage(payload);

  // Code "0" o vacio = ok. Cualquier Code/CategoryException presente = error.
  const hasErrorCode = Boolean(code && code !== '0' && code !== '0000');
  const hasCategory = Boolean(category);
  const hasErrorText = /desactivated|inexistent|no existe|not been found|no ha sido encontrado/i.test(
    `${description} ${message}`
  );

  if (hasErrorCode || hasCategory || hasErrorText) {
    return description || message || `GeoVictoria devolvio Code ${code} (${category}).`;
  }

  return null;
}

function formatGeoVictoriaDate(dateISO: string): string {
  return `${dateISO.replace(/-/g, '')}000000`;
}

function formatGeoVictoriaDateEndOfDay(dateISO: string): string {
  return `${dateISO.replace(/-/g, '')}235959`;
}

function formatGeoVictoriaDateShort(dateISO: string): string {
  return dateISO.replace(/-/g, '');
}

function normalizeOvertimeDuration(value: unknown): string {
  const text = cleanRequiredText(value);
  return /^\d{2}:\d{2}$/.test(text) ? text : '00:00';
}

function normalizeOvertimeValue(value: unknown): string {
  const text = cleanRequiredText(value);
  return /^\d+$/.test(text) ? text : '0';
}

function parseDecimalHoursToHHMM(value: unknown): string {
  const hours = typeof value === 'number' ? value : Number.parseFloat(cleanRequiredText(value).replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) {
    return '00:00';
  }
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(wholeHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseGeoVictoriaOvertimeDate(value: unknown): string {
  const text = cleanRequiredText(value);
  // La documentacion de GetOvertime dice que Date viene como 'yyyy-MM-dd HH:mm:ss',
  // pero la respuesta real usa 'yyyyMMddHHmmss' (14 digitos, sin separadores).
  if (/^\d{8}/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function isZeroDuration(value: string): boolean {
  return value === '00:00' || value === '0';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1000), 30_000);
  }
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.min(Math.max(dateMs - Date.now(), 0), 30_000);
  }
  return null;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<globalThis.Response> {
  const maxRetries = options.maxRetries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 800;
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, init);
      if (response.status !== 429 || attempt >= maxRetries) {
        return response;
      }
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const backoffMs = retryAfterMs ?? Math.min(baseDelayMs * 2 ** attempt, 8_000);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(backoffMs + jitter);
      attempt += 1;
    } catch (error) {
      if (attempt >= maxRetries) {
        const endpoint = (() => {
          try {
            return new URL(url).pathname;
          } catch {
            return url;
          }
        })();
        const message = error instanceof Error ? error.message : 'error de red';
        throw new Error(`No se pudo conectar con GeoVictoria (${endpoint}): ${message}`);
      }
      const backoffMs = Math.min(baseDelayMs * 2 ** attempt, 8_000);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(backoffMs + jitter);
      attempt += 1;
    }
  }
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

function isReciboCompanyId(companyId: string): boolean {
  const company = env.geoVictoriaCompanies.find((item) => item.companyId === companyId);
  return company?.alias.trim().toUpperCase() === 'RECIBO';
}

async function listGeoVictoriaUsers(token: string, tokenCacheKey: string): Promise<GeoVictoriaUser[]> {
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
      tokenCache.delete(tokenCacheKey);
    }
    throw new Error(`Error al consultar usuarios en GeoVictoria: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as GeoVictoriaUser[];
}

function geoVictoriaUserExists(users: GeoVictoriaUser[], identifier: string, email: string): boolean {
  const normalizedIdentifier = cleanRequiredText(identifier);
  const normalizedEmail = cleanRequiredText(email).toLowerCase();

  return users.some((user) => {
    const userIdentifier = cleanRequiredText(user.Identifier);
    const userEmail = cleanRequiredText(user.Email).toLowerCase();
    if (normalizedIdentifier) {
      return userIdentifier === normalizedIdentifier;
    }

    return normalizedEmail && userEmail === normalizedEmail;
  });
}

function getCompanyAliasById(companyId: string): string {
  return env.geoVictoriaCompanies.find((company) => company.companyId === companyId)?.alias ?? '';
}

async function insertGeoVictoriaShift(
  token: string,
  tokenCacheKey: string,
  startHour: string,
  endHour: string,
  breakStartHour: string | undefined,
  breakEndHour: string | undefined,
  custom: string,
  crossesMidnight: boolean
): Promise<string> {
  const payload: Record<string, string> = {
    StartHour: startHour,
    EndHour: endHour,
    Custom: custom
  };
  if (!crossesMidnight) {
    payload.ShiftDay = 'fin';
  }

  if (breakStartHour && breakEndHour) {
    payload.BreakStart = breakStartHour;
    payload.BreakEnd = breakEndHour;
  }

  const response = await fetchWithRetry(env.geoVictoriaShiftInsertUrl, {
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

async function resolveGeoVictoriaPositionId(
  token: string,
  tokenCacheKey: string,
  positionDescription: string
): Promise<string | undefined> {
  const normalizedTarget = cleanRequiredText(positionDescription).toLowerCase();
  if (!normalizedTarget) return undefined;

  const response = await fetch(env.geoVictoriaPositionListUrl, {
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
    return undefined;
  }

  const data = (await response.json()) as GeoVictoriaPosition[];
  const match = data.find(
    (position) =>
      cleanRequiredText(position.PositionState).toLowerCase() === 'enabled' &&
      cleanRequiredText(position.PositionDescription).toLowerCase() === normalizedTarget
  );

  return match?.Identifier ? cleanRequiredText(match.Identifier) : undefined;
}

async function listGeoVictoriaShifts(token: string, tokenCacheKey: string): Promise<GeoVictoriaShiftListItem[]> {
  const response = await fetchWithRetry(env.geoVictoriaShiftListUrl, {
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
  const response = await fetchWithRetry(env.geoVictoriaPlanningUrl, {
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
    let detail = '';
    if (rawText) {
      try {
        const parsed = JSON.parse(rawText) as unknown;
        detail = extractGeoVictoriaMessage(parsed) || rawText;
      } catch {
        detail = rawText;
      }
    }
    const detailSuffix = detail ? ` - ${detail.slice(0, 300)}` : '';
    throw new Error(`Error al asignar planificacion en GeoVictoria: ${response.status} ${response.statusText}${detailSuffix}`);
  }

  if (!rawText) {
    return 'OK';
  }

  let parsedOk: unknown = rawText;
  try {
    parsedOk = JSON.parse(rawText) as unknown;
  } catch {
    parsedOk = rawText;
  }

  // Aunque el status sea 200, GeoVictoria puede devolver un error en el cuerpo.
  const bodyError = extractGeoVictoriaErrorInBody(parsedOk);
  if (bodyError) {
    throw new Error(`Error al asignar planificacion en GeoVictoria: ${bodyError.slice(0, 300)}`);
  }

  return extractGeoVictoriaMessage(parsedOk) || rawText;
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

function resolveAuthorizedCompanyId(req: Request, requestedCompanyId: string | undefined | null): string | null {
  const normalizedRequestedCompanyId = cleanRequiredText(requestedCompanyId ?? '');
  const authUser = req.authUser;
  if (!authUser) {
    return null;
  }

  if (isSuperAdmin(authUser) || authUser.role === 'supervisor') {
    return normalizedRequestedCompanyId || null;
  }

  const assignedCompanyId = cleanRequiredText(authUser.companyId ?? '');
  if (!assignedCompanyId) {
    return null;
  }

  if (!normalizedRequestedCompanyId || normalizedRequestedCompanyId === assignedCompanyId) {
    return assignedCompanyId;
  }

  // Los administradores también pueden consultar Recibo
  if (isReciboCompanyId(normalizedRequestedCompanyId)) {
    return normalizedRequestedCompanyId;
  }

  return '__forbidden__';
}

export async function getGeoVictoriaCompaniesController(req: Request, res: Response): Promise<void> {
  const companiesSource = isSuperAdmin(req.authUser) || req.authUser?.role === 'supervisor'
    ? env.geoVictoriaCompanies
    : env.geoVictoriaCompanies.filter(
        (company) =>
          company.companyId === req.authUser?.companyId ||
          company.alias.trim().toUpperCase() === 'RECIBO'
      );

  const companies: GeoVictoriaCompanyResponse[] = companiesSource.map((company) => ({
    alias: company.alias,
    name: company.name,
    ruc: company.ruc,
    companyId: company.companyId,
    groups: company.alias.toUpperCase() === 'RECIBO' ? env.geoVictoriaReciboGroups : []
  }));

  res.status(200).json(companies);
}

export async function getGeoVictoriaEmployeesController(req: Request, res: Response): Promise<void> {
  const companyId = resolveAuthorizedCompanyId(req, req.query.companyId as string | undefined);
  if (companyId === '__forbidden__') {
    res.status(403).json({ error: 'No autorizado para consultar otra empresa.' });
    return;
  }

  let tokenCacheKey = 'main';
  let tokenLabel = 'principal';
  let credentialsUser = env.geoVictoriaUser;
  let credentialsPassword = env.geoVictoriaPassword;

  if (companyId) {
    const credentials = getCompanyCredentials(companyId);
    if (!credentials) {
      res.status(400).json({ error: `No existen credenciales configuradas para la company "${companyId}".` });
      return;
    }
    tokenCacheKey = `company:${companyId}`;
    tokenLabel = companyId;
    credentialsUser = credentials.user;
    credentialsPassword = credentials.password;
  }

  if (!credentialsUser || !credentialsPassword) {
    res.status(503).json({ error: 'Credenciales de GeoVictoria no configuradas en el servidor.' });
    return;
  }

  let token: string;
  try {
    token = await getTokenForCredentials(tokenCacheKey, credentialsUser, credentialsPassword, tokenLabel);
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
      tokenCache.delete(tokenCacheKey);
    }
    res.status(502).json({ error: `Error al consultar GeoVictoria: ${response.status} ${response.statusText}` });
    return;
  }

  const data = (await response.json()) as GeoVictoriaUser[];
  const active = data.filter((user) => user.Enabled === '1');
  res.status(200).json(active);
}

export async function getGeoVictoriaEmployeesAllController(req: Request, res: Response): Promise<void> {
  const companyId = resolveAuthorizedCompanyId(req, req.query.companyId as string | undefined);
  if (companyId === '__forbidden__') {
    res.status(403).json({ error: 'No autorizado para consultar otra empresa.' });
    return;
  }

  let tokenCacheKey = 'main';
  let tokenLabel = 'principal';
  let credentialsUser = env.geoVictoriaUser;
  let credentialsPassword = env.geoVictoriaPassword;

  if (companyId) {
    if (isReciboCompanyId(companyId)) {
      if (!env.geoVictoriaReciboUser || !env.geoVictoriaReciboPassword) {
        res.status(503).json({ error: 'Credenciales de GeoVictoria Recibo no configuradas en el servidor.' });
        return;
      }
      tokenCacheKey = 'recibo';
      tokenLabel = 'Recibo';
      credentialsUser = env.geoVictoriaReciboUser;
      credentialsPassword = env.geoVictoriaReciboPassword;
    } else {
      const credentials = getCompanyCredentials(companyId);
      if (!credentials) {
        res.status(400).json({ error: `No existen credenciales configuradas para la company "${companyId}".` });
        return;
      }
      tokenCacheKey = `company:${companyId}`;
      tokenLabel = companyId;
      credentialsUser = credentials.user;
      credentialsPassword = credentials.password;
    }
  }

  if (!credentialsUser || !credentialsPassword) {
    res.status(503).json({ error: 'Credenciales de GeoVictoria no configuradas en el servidor.' });
    return;
  }

  let token: string;
  try {
    token = await getTokenForCredentials(tokenCacheKey, credentialsUser, credentialsPassword, tokenLabel);
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
    if (response.status === 401) {
      tokenCache.delete(tokenCacheKey);
    }
    res.status(502).json({ error: `Error al consultar GeoVictoria: ${response.status} ${response.statusText}` });
    return;
  }

  const data = (await response.json()) as GeoVictoriaUser[];
  res.status(200).json(data);
}

export async function getGeoVictoriaPositionsController(req: Request, res: Response): Promise<void> {
  const companyId = resolveAuthorizedCompanyId(req, req.query.companyId as string | undefined);
  if (companyId === '__forbidden__') {
    res.status(403).json({ error: 'No autorizado para consultar otra empresa.' });
    return;
  }

  let tokenCacheKey = 'main';
  let tokenLabel = 'principal';
  let credentialsUser = env.geoVictoriaUser;
  let credentialsPassword = env.geoVictoriaPassword;

  if (companyId) {
    if (isReciboCompanyId(companyId)) {
      if (!env.geoVictoriaReciboUser || !env.geoVictoriaReciboPassword) {
        res.status(503).json({ error: 'Credenciales de GeoVictoria Recibo no configuradas en el servidor.' });
        return;
      }
      tokenCacheKey = 'recibo';
      tokenLabel = 'Recibo';
      credentialsUser = env.geoVictoriaReciboUser;
      credentialsPassword = env.geoVictoriaReciboPassword;
    } else {
      const credentials = getCompanyCredentials(companyId);
      if (!credentials) {
        res.status(400).json({ error: `No existen credenciales configuradas para la company "${companyId}".` });
        return;
      }
      tokenCacheKey = `company:${companyId}`;
      tokenLabel = companyId;
      credentialsUser = credentials.user;
      credentialsPassword = credentials.password;
    }
  }

  if (!credentialsUser || !credentialsPassword) {
    res.status(503).json({ error: 'Credenciales de GeoVictoria no configuradas en el servidor.' });
    return;
  }

  let token: string;
  try {
    token = await getTokenForCredentials(tokenCacheKey, credentialsUser, credentialsPassword, tokenLabel);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de autenticación con GeoVictoria.';
    res.status(502).json({ error: message });
    return;
  }

  const response = await fetch(env.geoVictoriaPositionListUrl, {
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
    res.status(502).json({ error: `Error al consultar cargos en GeoVictoria: ${response.status} ${response.statusText}` });
    return;
  }

  const data = (await response.json()) as GeoVictoriaPosition[];
  const enabled = data.filter((position) => cleanRequiredText(position.PositionState).toLowerCase() === 'enabled');
  res.status(200).json(enabled);
}

export async function addGeoVictoriaUserController(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as GeoVictoriaAddUserRequestBody;
  const companyId = resolveAuthorizedCompanyId(req, body.CompanyId ?? body.companyId);
  if (companyId === '__forbidden__') {
    res.status(403).json({ error: 'No autorizado para registrar usuarios en otra empresa.' });
    return;
  }
  const identifier = cleanRequiredText(body.Identifier ?? body.identifier);
  const email = cleanRequiredText(body.Email ?? body.email);
  const name = cleanRequiredText(body.Name ?? body.name);
  const lastName = cleanRequiredText(body.LastName ?? body.lastName);
  const costCenterCode = cleanRequiredText(body.CostCenterCode ?? body.costCenterCode);
  const positionDescription = cleanRequiredText(body.PositionDescription ?? body.positionDescription);

  if (!companyId || !identifier || !email || !name || !lastName || !costCenterCode) {
    res
      .status(400)
      .json({ error: 'CompanyId, Identifier, Email, Name, LastName y CostCenterCode son obligatorios para enviar a GeoVictoria.' });
    return;
  }

  const isRecibo = isReciboCompanyId(companyId);
  if (isRecibo) {
    const validReciboGroup = env.geoVictoriaReciboGroups.some((group) => group.code_centro_costo === costCenterCode);
    if (!validReciboGroup) {
      res.status(400).json({ error: 'El centro de costo enviado no corresponde a un grupo válido de Recibo.' });
      return;
    }
  }

  let token: string;
  try {
    if (isRecibo) {
      token = await getReciboToken();
    } else {
      const credentials = getCompanyCredentials(companyId);
      if (!credentials) {
        res.status(400).json({ error: `No existen credenciales configuradas para la company "${companyId}".` });
        return;
      }

      token = await getTokenForCredentials(
        `company:${companyId}`,
        credentials.user,
        credentials.password,
        companyId
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de autenticación con GeoVictoria.';
    res.status(502).json({ error: message });
    return;
  }

  const positionCacheKey = isRecibo ? 'recibo' : `company:${companyId}`;
  const positionId = await resolveGeoVictoriaPositionId(token, positionCacheKey, positionDescription);
  const userPayload = {
    Identifier: identifier,
    Email: email,
    Name: name,
    LastName: lastName,
    Lastname: lastName,
    CostCenterCode: costCenterCode,
    Enabled: '1',
    ...(positionId ? { PositionId: positionId } : {})
  };

  const response = await fetch(env.geoVictoriaUserAddUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userPayload)
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

  const parsedMessage = extractGeoVictoriaMessage(parsedBody);
  const userAlreadyExists =
    typeof parsedBody === 'object' &&
    parsedBody !== null &&
    'Success' in parsedBody &&
    parsedBody.Success === false &&
    /already exists|ya existe/i.test(parsedMessage || '');

  if (userAlreadyExists) {
    let existingUsers: GeoVictoriaUser[];
    try {
      existingUsers = await listGeoVictoriaUsers(token, positionCacheKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo verificar la existencia del usuario en GeoVictoria.';
      res.status(502).json({ error: message });
      return;
    }

    if (!geoVictoriaUserExists(existingUsers, identifier, email)) {
      res.status(409).json({
        error: parsedMessage || 'GeoVictoria indicó que el usuario ya existe, pero no fue encontrado para editar.'
      });
      return;
    }

    const editResponse = await fetch(env.geoVictoriaUserEditUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userPayload)
    });

    const editRawText = await editResponse.text();
    let editParsedBody: unknown = null;
    if (editRawText) {
      try {
        editParsedBody = JSON.parse(editRawText) as unknown;
      } catch {
        editParsedBody = editRawText;
      }
    }

    if (!editResponse.ok) {
      if (editResponse.status === 401) {
        tokenCache.delete(positionCacheKey);
      }

      res.status(502).json({
        error: extractGeoVictoriaMessage(editParsedBody) || `Error al actualizar usuario en GeoVictoria: ${editResponse.status} ${editResponse.statusText}`
      });
      return;
    }

    const editMessage = extractGeoVictoriaMessage(editParsedBody) || 'Usuario actualizado correctamente en GeoVictoria.';
    if (/not been found|no ha sido encontrado|no existe/i.test(editMessage)) {
      res.status(409).json({
        error: editMessage
      });
      return;
    }

    res.status(200).json({ message: editMessage });
    return;
  }

  if (typeof parsedBody === 'object' && parsedBody !== null && 'Success' in parsedBody && parsedBody.Success === false) {
    res.status(409).json({
      error: parsedMessage || 'GeoVictoria rechazó la creación del usuario.'
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
  const usersByCompanyId = new Map<string, GeoVictoriaUser[]>();
  const preclearedDays = new Set<string>();
  const interItemDelayMs = 150;
  let isFirstItem = true;
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
    if (!isFirstItem) {
      await sleep(interItemDelayMs);
    }
    isFirstItem = false;

    const rawAssignmentType = cleanRequiredText(item.assignmentType).toLowerCase();
    const assignmentType = rawAssignmentType === 'rest' ? 'rest' : rawAssignmentType === 'free' ? 'free' : 'work';
    const employeeId = cleanRequiredText(item.employeeId);
    const employeeName = cleanRequiredText(item.employeeName);
    const companyId = cleanRequiredText(item.companyId);
    const companyAlias = cleanRequiredText(item.companyAlias) || getCompanyAliasById(companyId);
    const userIdentifier = cleanRequiredText(item.userIdentifier);
    const costCenterCode = cleanRequiredText(item.costCenterCode);
    const dateISO = cleanRequiredText(item.dateISO);
    const startHour = cleanRequiredText(item.startHour);
    const endHour = cleanRequiredText(item.endHour);
    const breakStartHour = cleanRequiredText(item.breakStartHour);
    const breakEndHour = cleanRequiredText(item.breakEndHour);
    const custom = (cleanRequiredText(item.custom) || `${startHour}-${endHour}`).slice(0, 20);
    const crossesMidnight = item.crossesMidnight === true;
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
        (crossesMidnight ||
          (breakStartMinutes >= startMinutes && breakEndMinutes <= endMinutes)));

    const isReciboCompany = companyAlias.toUpperCase() === 'RECIBO';

    if (
      !employeeId ||
      !employeeName ||
      !companyId ||
      !userIdentifier ||
      (isReciboCompany && !costCenterCode) ||
      !isValidDateISO(dateISO) ||
      (assignmentType === 'work' &&
        (startMinutes === null ||
          endMinutes === null ||
          (!crossesMidnight && endMinutes <= startMinutes))) ||
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
        error: 'Fila invalida. Verifica company, identificador, centro de costo, fecha y horas.'
      });
      continue;
    }

    const credentials = isReciboCompany
      ? env.geoVictoriaReciboUser && env.geoVictoriaReciboPassword
        ? {
            companyId,
            user: env.geoVictoriaReciboUser,
            password: env.geoVictoriaReciboPassword
          }
        : null
      : getCompanyCredentials(companyId);
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

    const tokenCacheKey = isReciboCompany ? 'recibo' : `company:${companyId}`;
    let shiftId: string | undefined;
    let shiftSource: 'existing' | 'created' | undefined;
    let shiftMessage = '';

    try {
      const token = await getTokenForCredentials(tokenCacheKey, credentials.user, credentials.password, companyId);

      // Pre-check: el usuario debe existir y estar habilitado en GeoVictoria.
      // Si no, GeoVictoria rechaza la planificacion con un 400 generico
      // ("Desactivated or inexistent users detected"). Validamos antes para
      // dar un error claro y no crear turnos huerfanos.
      let companyUsers = usersByCompanyId.get(companyId);
      if (!companyUsers) {
        companyUsers = await listGeoVictoriaUsers(token, tokenCacheKey);
        usersByCompanyId.set(companyId, companyUsers);
      }
      const geoVictoriaUser = companyUsers.find(
        (user) => cleanRequiredText(user.Identifier) === userIdentifier
      );
      if (!geoVictoriaUser || geoVictoriaUser.Enabled !== '1') {
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
          shiftOk: false,
          planningOk: false,
          error: `Usuario desactivado o inexistente en GeoVictoria: ${userIdentifier}`
        });
        continue;
      }

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
            : `${companyId}|${startHour}|${endHour}|${breakStartHour}|${breakEndHour}|${crossesMidnight ? 'x' : 'n'}`;
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
            custom,
            crossesMidnight
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

export async function addGeoVictoriaOvertimeController(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as GeoVictoriaOvertimeRequestBody;
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    res.status(400).json({ error: 'Debes enviar al menos una hora extra para registrar.' });
    return;
  }

  const interItemDelayMs = 150;
  let isFirstItem = true;
  const results: Array<{
    employeeId: string;
    employeeName: string;
    userIdentifier: string;
    companyId: string;
    dateISO: string;
    durationBefore: string;
    durationAfter: string;
    valueBefore: string;
    valueAfter: string;
    ok: boolean;
    message?: string;
    error?: string;
  }> = [];

  for (const item of items) {
    if (!isFirstItem) {
      await sleep(interItemDelayMs);
    }
    isFirstItem = false;

    const employeeId = cleanRequiredText(item.employeeId);
    const employeeName = cleanRequiredText(item.employeeName);
    const companyId = cleanRequiredText(item.companyId);
    const companyAlias = cleanRequiredText(item.companyAlias) || getCompanyAliasById(companyId);
    const userIdentifier = cleanRequiredText(item.userIdentifier);
    const dateISO = cleanRequiredText(item.dateISO);
    const durationBefore = normalizeOvertimeDuration(item.durationBefore);
    const durationAfter = normalizeOvertimeDuration(item.durationAfter);
    const valueBefore = normalizeOvertimeValue(item.valueBefore);
    const valueAfter = normalizeOvertimeValue(item.valueAfter);

    const base = {
      employeeId,
      employeeName,
      userIdentifier,
      companyId,
      dateISO,
      durationBefore,
      durationAfter,
      valueBefore,
      valueAfter
    };

    if (
      !companyId ||
      !userIdentifier ||
      !isValidDateISO(dateISO) ||
      (isZeroDuration(durationBefore) && isZeroDuration(durationAfter))
    ) {
      results.push({
        ...base,
        ok: false,
        error: 'Fila invalida. Verifica company, identificador, fecha y al menos una duracion de hora extra.'
      });
      continue;
    }

    const isReciboCompany = companyAlias.toUpperCase() === 'RECIBO';
    const credentials = isReciboCompany
      ? env.geoVictoriaReciboUser && env.geoVictoriaReciboPassword
        ? { companyId, user: env.geoVictoriaReciboUser, password: env.geoVictoriaReciboPassword }
        : null
      : getCompanyCredentials(companyId);
    if (!credentials) {
      results.push({
        ...base,
        ok: false,
        error: `No existen credenciales configuradas para la company "${companyId}".`
      });
      continue;
    }

    const tokenCacheKey = isReciboCompany ? 'recibo' : `company:${companyId}`;

    try {
      const token = await getTokenForCredentials(tokenCacheKey, credentials.user, credentials.password, companyId);
      const gvDate = formatGeoVictoriaDateShort(dateISO);
      const payload = [
        {
          UserIdentifier: userIdentifier,
          StartDateOvertime: gvDate,
          EndDateOvertime: gvDate,
          DurationBefore: durationBefore,
          DurationAfter: durationAfter,
          OvertimeValueAfter: valueAfter,
          OvertimeValueBefore: valueBefore
        }
      ];

      const response = await fetchWithRetry(env.geoVictoriaOvertimeAddUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const rawText = (await response.text()).trim();
      let parsed: unknown = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText) as unknown;
        } catch {
          parsed = rawText;
        }
      }

      if (!response.ok) {
        if (response.status === 401) {
          tokenCache.delete(tokenCacheKey);
        }
        results.push({
          ...base,
          ok: false,
          error:
            extractGeoVictoriaMessage(parsed) ||
            `Error al registrar hora extra en GeoVictoria: ${response.status} ${response.statusText}`
        });
        continue;
      }

      const success =
        typeof parsed === 'object' && parsed !== null && 'Success' in parsed
          ? (parsed as { Success?: boolean }).Success !== false
          : true;

      const bodyError = extractGeoVictoriaErrorInBody(parsed);

      if (!success || bodyError) {
        results.push({
          ...base,
          ok: false,
          error: bodyError || extractGeoVictoriaMessage(parsed) || 'GeoVictoria rechazó la hora extra.'
        });
        continue;
      }

      results.push({
        ...base,
        ok: true,
        message: extractGeoVictoriaMessage(parsed) || 'Hora extra registrada correctamente.'
      });
    } catch (error) {
      results.push({
        ...base,
        ok: false,
        error: error instanceof Error ? error.message : 'Error al registrar hora extra en GeoVictoria.'
      });
    }
  }

  const added = results.filter((item) => item.ok).length;
  const failed = results.length - added;
  res.status(200).json({ added, failed, results });
}

export async function clearGeoVictoriaOvertimeController(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as GeoVictoriaOvertimeClearRequestBody;
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (rawItems.length === 0) {
    res.status(400).json({ error: 'Debes enviar al menos un dia para limpiar horas extra.' });
    return;
  }

  const itemByKey = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      userIdentifier: string;
      companyId: string;
      companyAlias: string;
      dateISO: string;
      durationBefore: string;
      durationAfter: string;
    }
  >();

  for (const item of rawItems) {
    const employeeId = cleanRequiredText(item.employeeId);
    const employeeName = cleanRequiredText(item.employeeName);
    const companyId = cleanRequiredText(item.companyId);
    const companyAlias = cleanRequiredText(item.companyAlias) || getCompanyAliasById(companyId);
    const userIdentifier = cleanRequiredText(item.userIdentifier);
    const dateISO = cleanRequiredText(item.dateISO);
    const durationBefore = normalizeOvertimeDuration(item.durationBefore);
    const durationAfter = normalizeOvertimeDuration(item.durationAfter);
    const key = `${companyId}::${userIdentifier}::${dateISO}`;

    if (
      !companyId ||
      !userIdentifier ||
      !isValidDateISO(dateISO) ||
      (isZeroDuration(durationBefore) && isZeroDuration(durationAfter))
    ) {
      continue;
    }

    itemByKey.set(key, {
      employeeId,
      employeeName,
      userIdentifier,
      companyId,
      companyAlias,
      dateISO,
      durationBefore,
      durationAfter
    });
  }

  if (itemByKey.size === 0) {
    res.status(400).json({ error: 'No hay filas validas para limpiar horas extra.' });
    return;
  }

  const items = Array.from(itemByKey.values());
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = `${item.companyId}::${item.companyAlias}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const results: Array<{
    employeeId: string;
    employeeName: string;
    userIdentifier: string;
    companyId: string;
    dateISO: string;
    durationBefore: string;
    durationAfter: string;
    ok: boolean;
    message?: string;
    error?: string;
  }> = [];

  for (const groupItems of groups.values()) {
    const first = groupItems[0];
    const isReciboCompany = first.companyAlias.toUpperCase() === 'RECIBO';
    const credentials = isReciboCompany
      ? env.geoVictoriaReciboUser && env.geoVictoriaReciboPassword
        ? { companyId: first.companyId, user: env.geoVictoriaReciboUser, password: env.geoVictoriaReciboPassword }
        : null
      : getCompanyCredentials(first.companyId);

    if (!credentials) {
      for (const item of groupItems) {
        results.push({
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          userIdentifier: item.userIdentifier,
          companyId: item.companyId,
          dateISO: item.dateISO,
          durationBefore: '00:00',
          durationAfter: '00:00',
          ok: false,
          error: `No existen credenciales configuradas para la company "${item.companyId}".`
        });
      }
      continue;
    }

    const tokenCacheKey = isReciboCompany ? 'recibo' : `company:${first.companyId}`;

    try {
      const token = await getTokenForCredentials(tokenCacheKey, credentials.user, credentials.password, first.companyId);

      const userIdentifiers = Array.from(new Set(groupItems.map((item) => item.userIdentifier))).join(',');
      const sortedDates = groupItems.map((item) => item.dateISO).sort();
      // GetOvertime, a diferencia de Add/Delete, exige 'yyyyMMddHHmmss' (14 digitos)
      // pese a que su propia documentacion dice 'yyyyMMdd' (confirmado via Postman:
      // {"Code":"0176","Description":"Invalid date format","PossibleSolution":"Please use 'yyyyMMddHHmmss'"}).
      const startDate = formatGeoVictoriaDate(sortedDates[0]);
      const endDate = formatGeoVictoriaDateEndOfDay(sortedDates[sortedDates.length - 1]);

      // Se consulta el estado real en GeoVictoria antes de eliminar: la duracion
      // que este modulo cree haber agregado puede no coincidir con lo realmente
      // registrado (por eso "eliminar" fallaba en silencio). Si la consulta
      // falla, se usa como respaldo la duracion conocida localmente.
      const actualDurationByKey = new Map<string, { durationBefore: string; durationAfter: string }>();
      let getSucceeded = false;

      try {
        const getResponse = await fetchWithRetry(env.geoVictoriaOvertimeGetUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            StartDate: startDate,
            EndDate: endDate,
            UserIdentifiers: userIdentifiers
          })
        });

        const getRawText = (await getResponse.text()).trim();
        let getParsed: unknown = null;
        if (getRawText) {
          try {
            getParsed = JSON.parse(getRawText) as unknown;
          } catch {
            getParsed = getRawText;
          }
        }

        const getSuccess =
          typeof getParsed === 'object' && getParsed !== null && 'Success' in getParsed
            ? (getParsed as { Success?: boolean }).Success !== false
            : getResponse.ok;
        const getBodyError = extractGeoVictoriaErrorInBody(getParsed);

        if (getResponse.status === 401) {
          tokenCache.delete(tokenCacheKey);
        }

        if (getResponse.ok && getSuccess && !getBodyError) {
          getSucceeded = true;
          const responseRows =
            typeof getParsed === 'object' &&
            getParsed !== null &&
            Array.isArray((getParsed as { Response?: unknown }).Response)
              ? (getParsed as { Response: Array<Record<string, unknown>> }).Response
              : [];

          for (const row of responseRows) {
            const userIdentifier = cleanRequiredText(row.UserIdentifier);
            const dateISO = parseGeoVictoriaOvertimeDate(row.Date);
            if (!userIdentifier || !dateISO) continue;
            // ExtraTimeBefore/After son el calculo crudo de posible sobretiempo segun
            // el turno; ApprovedOvertimeBefore/After es lo realmente registrado via
            // OverTime/Add, que es lo que Delete exige no superar.
            actualDurationByKey.set(`${userIdentifier}::${dateISO}`, {
              durationBefore: parseDecimalHoursToHHMM(row.ApprovedOvertimeBefore),
              durationAfter: parseDecimalHoursToHHMM(row.ApprovedOvertimeAfter)
            });
          }
        }
      } catch {
        // Se ignora: se usa la duracion conocida localmente como respaldo.
      }

      const skipped: typeof groupItems = [];
      const toDelete: Array<{ item: (typeof groupItems)[number]; durationBefore: string; durationAfter: string }> = [];

      for (const item of groupItems) {
        const actual = actualDurationByKey.get(`${item.userIdentifier}::${item.dateISO}`);
        const effective = getSucceeded
          ? actual ?? { durationBefore: '00:00', durationAfter: '00:00' }
          : { durationBefore: item.durationBefore, durationAfter: item.durationAfter };

        if (isZeroDuration(effective.durationBefore) && isZeroDuration(effective.durationAfter)) {
          skipped.push(item);
          continue;
        }
        toDelete.push({ item, durationBefore: effective.durationBefore, durationAfter: effective.durationAfter });
      }

      for (const item of skipped) {
        results.push({
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          userIdentifier: item.userIdentifier,
          companyId: item.companyId,
          dateISO: item.dateISO,
          durationBefore: '00:00',
          durationAfter: '00:00',
          ok: true,
          message: 'No habia horas extra para eliminar.'
        });
      }

      if (toDelete.length === 0) {
        continue;
      }

      const deletions = toDelete.map(({ item, durationBefore, durationAfter }) => ({
        UserIdentifier: item.userIdentifier,
        Date: formatGeoVictoriaDateShort(item.dateISO),
        DurationBefore: durationBefore,
        DurationAfter: durationAfter
      }));

      const deleteResponse = await fetchWithRetry(env.geoVictoriaOvertimeDeleteUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Deletions: deletions })
      });

      const deleteRawText = (await deleteResponse.text()).trim();
      let deleteParsed: unknown = null;
      if (deleteRawText) {
        try {
          deleteParsed = JSON.parse(deleteRawText) as unknown;
        } catch {
          deleteParsed = deleteRawText;
        }
      }

      const success =
        typeof deleteParsed === 'object' && deleteParsed !== null && 'Success' in deleteParsed
          ? (deleteParsed as { Success?: boolean }).Success !== false
          : deleteResponse.ok;
      const deleteBodyError = extractGeoVictoriaErrorInBody(deleteParsed);

      if (!deleteResponse.ok || !success || deleteBodyError) {
        if (deleteResponse.status === 401) {
          tokenCache.delete(tokenCacheKey);
        }
        const error =
          deleteBodyError ||
          extractGeoVictoriaMessage(deleteParsed) ||
          `Error al eliminar horas extra en GeoVictoria: ${deleteResponse.status} ${deleteResponse.statusText}`;
        for (const { item, durationBefore, durationAfter } of toDelete) {
          results.push({
            employeeId: item.employeeId,
            employeeName: item.employeeName,
            userIdentifier: item.userIdentifier,
            companyId: item.companyId,
            dateISO: item.dateISO,
            durationBefore,
            durationAfter,
            ok: false,
            error
          });
        }
        continue;
      }

      for (const { item, durationBefore, durationAfter } of toDelete) {
        results.push({
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          userIdentifier: item.userIdentifier,
          companyId: item.companyId,
          dateISO: item.dateISO,
          durationBefore,
          durationAfter,
          ok: true,
          message: 'Horas extra eliminadas correctamente.'
        });
      }
    } catch (error) {
      for (const item of groupItems) {
        results.push({
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          userIdentifier: item.userIdentifier,
          companyId: item.companyId,
          dateISO: item.dateISO,
          durationBefore: '00:00',
          durationAfter: '00:00',
          ok: false,
          error: error instanceof Error ? error.message : 'Error al limpiar horas extra en GeoVictoria.'
        });
      }
    }
  }

  const deleted = results.filter((item) => item.ok && (!isZeroDuration(item.durationBefore) || !isZeroDuration(item.durationAfter))).length;
  const failed = results.filter((item) => !item.ok).length;
  res.status(200).json({ deleted, failed, results });
}

export async function saveMigrationLogsController(req: Request, res: Response): Promise<void> {
  const { logs } = req.body as {
    logs: Array<{
      companyId: string;
      areaId: string;
      scopedWeekId: string;
      employeeId: string;
      employeeName: string;
      userIdentifier: string;
      groupKey: string;
      results: unknown[];
      overtimeResults?: unknown[];
      migratedBy: string | null;
      migratedAt: string;
    }>;
  };

  if (!Array.isArray(logs) || logs.length === 0) {
    res.status(400).json({ error: 'logs array required' });
    return;
  }

  let saved = 0;
  for (const log of logs) {
    const result = await MigrationLogModel.updateOne(
      { companyId: log.companyId, scopedWeekId: log.scopedWeekId, groupKey: log.groupKey },
      {
        $set: {
          employeeId: log.employeeId,
          employeeName: log.employeeName,
          userIdentifier: log.userIdentifier,
          areaId: log.areaId,
          results: log.results,
          overtimeResults: Array.isArray(log.overtimeResults) ? log.overtimeResults : [],
          migratedBy: log.migratedBy,
          migratedAt: new Date(log.migratedAt)
        },
        $setOnInsert: { _id: randomUUID() }
      },
      { upsert: true }
    ).exec();
    if (result.upsertedCount > 0 || result.modifiedCount > 0 || result.matchedCount > 0) {
      saved++;
    }
    console.log('[MigrationLog] upsert result:', JSON.stringify({ filter: { companyId: log.companyId, scopedWeekId: log.scopedWeekId, groupKey: log.groupKey }, result }));
  }

  res.status(200).json({ saved });
}

export async function getMigrationLogsController(req: Request, res: Response): Promise<void> {
  const { companyId, scopedWeekId } = req.query as { companyId?: string; scopedWeekId?: string };

  if (!scopedWeekId) {
    res.status(400).json({ error: 'scopedWeekId query param required' });
    return;
  }

  const filter: Record<string, string> = { scopedWeekId };
  if (companyId) filter.companyId = companyId;

  const docs = await MigrationLogModel.find(filter).sort({ migratedAt: -1 }).lean();
  const logs = docs.map((doc) => ({
    groupKey: doc.groupKey,
    employeeId: doc.employeeId,
    employeeName: doc.employeeName,
    userIdentifier: doc.userIdentifier,
    areaId: doc.areaId,
    results: doc.results,
    overtimeResults: Array.isArray(doc.overtimeResults) ? doc.overtimeResults : [],
    migratedBy: doc.migratedBy,
    migratedAt: doc.migratedAt.toISOString()
  }));

  res.status(200).json({ logs });
}
