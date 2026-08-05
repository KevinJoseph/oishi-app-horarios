import type { SeedState } from '../data/seed';
import type { AreaId, ValidationRequirements, Week, WeekAudit, WeekConfigurationSnapshot, WeekPlan } from '../types';
import { request } from './http';

function companyQuery(companyId?: string | null): string {
  return companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
}

export function fetchPlannerState(companyId?: string | null): Promise<SeedState> {
  return request<SeedState>(`/state${companyQuery(companyId)}`);
}

export function savePlannerState(payload: SeedState, companyId?: string | null): Promise<SeedState> {
  return request<SeedState>(`/state${companyQuery(companyId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export type AreaSettingsUpdateEntry = {
  areaId: string;
  timeSlots?: import('../types').TimeSlot[];
  shiftRanges?: import('../types').ShiftRanges;
  validationRequirements?: import('../types').ValidationRequirements;
  breakConfig?: import('../types').BreakConfig;
};

export type PlannerStatePartialUpdatePayload = {
  employees?: SeedState['employees'];
  roles?: SeedState['roles'];
  weeks?: Week[];
  weekEntries?: Array<{
    weekId: string;
    weekPlan?: WeekPlan;
    weekAudit?: WeekAudit;
    weekConfig?: WeekConfigurationSnapshot;
    validated?: boolean;
  }>;
  areaSettings?: AreaSettingsUpdateEntry[];
};

export function savePlannerStatePartial(payload: PlannerStatePartialUpdatePayload, companyId?: string | null): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/state/partial${companyQuery(companyId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function saveValidationRequirements(payload: {
  areaId: AreaId;
  validationRequirements: ValidationRequirements;
}, companyId?: string | null): Promise<SeedState> {
  return request<SeedState>(`/state/validation-requirements${companyQuery(companyId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function resetPlannerState(companyId?: string | null): Promise<SeedState> {
  return request<SeedState>(`/state/reset${companyQuery(companyId)}`, {
    method: 'POST'
  });
}

export interface GeoVictoriaEmployee {
  Id: string;
  Identifier: string;
  Name: string;
  LastName: string;
  Phone: string;
  Email: string;
  GroupDescription: string;
  CostCenterCode?: string;
  PositionDescription: string;
  Enabled: string;
  IntegrationCode: string;
  UserCompanyIdentifier?: string;
}

export interface GeoVictoriaCompany {
  alias: string;
  name: string;
  ruc: string;
  companyId: string;
  groups: GeoVictoriaCompanyGroup[];
}

export interface GeoVictoriaCompanyGroup {
  name: string;
  code_centro_costo: string;
}

export interface GeoVictoriaPosition {
  Identifier: string;
  PositionDescription: string;
  PositionState: string;
}

export interface GeoVictoriaPlanningMigrationItem {
  assignmentType: 'work' | 'rest' | 'free';
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyAlias?: string;
  userIdentifier: string;
  dateISO: string;
  startHour: string;
  endHour: string;
  breakStartHour?: string;
  breakEndHour?: string;
  costCenterCode?: string;
  custom: string;
  crossesMidnight?: boolean;
}

export interface GeoVictoriaPlanningMigrationResult extends GeoVictoriaPlanningMigrationItem {
  ok: boolean;
  shiftId?: string;
  shiftSource?: 'existing' | 'created';
  shiftOk?: boolean;
  shiftMessage?: string;
  planningOk?: boolean;
  planningResponse?: string;
  planningMessage?: string;
  error?: string;
}

export function fetchGeoVictoriaEmployees(companyId?: string): Promise<GeoVictoriaEmployee[]> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return request<GeoVictoriaEmployee[]>(`/geovictoria/employees${query}`);
}

export function fetchGeoVictoriaEmployeesAll(companyId?: string): Promise<GeoVictoriaEmployee[]> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return request<GeoVictoriaEmployee[]>(`/geovictoria/employees-all${query}`);
}

export function fetchGeoVictoriaReciboEmployees(): Promise<GeoVictoriaEmployee[]> {
  return request<GeoVictoriaEmployee[]>('/geovictoria/recibo-employees');
}

export function fetchGeoVictoriaCompanies(): Promise<GeoVictoriaCompany[]> {
  return request<GeoVictoriaCompany[]>('/geovictoria/companies');
}

export function fetchGeoVictoriaPositions(companyId?: string): Promise<GeoVictoriaPosition[]> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return request<GeoVictoriaPosition[]>(`/geovictoria/positions${query}`);
}

export type GeoVictoriaAddUserPayload = {
  CompanyId: string;
  Identifier: string;
  Email: string;
  Name: string;
  LastName: string;
  CostCenterCode: string;
  PositionDescription?: string;
  Enabled: string;
};

export function sendEmployeeToGeoVictoria(payload: GeoVictoriaAddUserPayload): Promise<{ message?: string }> {
  return request<{ message?: string }>('/geovictoria/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function migrateGeoVictoriaPlanning(
  items: GeoVictoriaPlanningMigrationItem[]
): Promise<{ migrated: number; failed: number; results: GeoVictoriaPlanningMigrationResult[] }> {
  return request<{ migrated: number; failed: number; results: GeoVictoriaPlanningMigrationResult[] }>(
    '/geovictoria/planning/migrate',
    {
      method: 'POST',
      body: JSON.stringify({ items })
    }
  );
}

export interface GeoVictoriaOvertimeItem {
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyAlias?: string;
  userIdentifier: string;
  dateISO: string;
  durationBefore: string;
  durationAfter: string;
  valueBefore: string;
  valueAfter: string;
}

export interface GeoVictoriaOvertimeResult extends GeoVictoriaOvertimeItem {
  ok: boolean;
  message?: string;
  error?: string;
}

export interface GeoVictoriaOvertimeClearItem {
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyAlias?: string;
  userIdentifier: string;
  dateISO: string;
}

export interface GeoVictoriaOvertimeClearResult extends GeoVictoriaOvertimeClearItem {
  durationBefore: string;
  durationAfter: string;
  ok: boolean;
  message?: string;
  error?: string;
}

export function addGeoVictoriaOvertime(
  items: GeoVictoriaOvertimeItem[]
): Promise<{ added: number; failed: number; results: GeoVictoriaOvertimeResult[] }> {
  return request<{ added: number; failed: number; results: GeoVictoriaOvertimeResult[] }>(
    '/geovictoria/overtime/add',
    {
      method: 'POST',
      body: JSON.stringify({ items })
    }
  );
}

export function clearGeoVictoriaOvertime(
  items: GeoVictoriaOvertimeClearItem[]
): Promise<{ deleted: number; failed: number; results: GeoVictoriaOvertimeClearResult[] }> {
  return request<{ deleted: number; failed: number; results: GeoVictoriaOvertimeClearResult[] }>(
    '/geovictoria/overtime/clear',
    {
      method: 'POST',
      body: JSON.stringify({ items })
    }
  );
}

export type MigrationLogEntry = {
  companyId: string;
  areaId: string;
  scopedWeekId: string;
  employeeId: string;
  employeeName: string;
  userIdentifier: string;
  groupKey: string;
  results: GeoVictoriaPlanningMigrationResult[];
  overtimeResults?: GeoVictoriaOvertimeResult[];
  migratedBy: string | null;
  migratedAt: string;
};

export function saveMigrationLogs(logs: MigrationLogEntry[]): Promise<{ saved: number }> {
  return request<{ saved: number }>('/geovictoria/migration-logs', {
    method: 'POST',
    body: JSON.stringify({ logs })
  });
}

export function fetchMigrationLogs(
  scopedWeekId: string,
  companyId?: string | null
): Promise<{ logs: MigrationLogEntry[] }> {
  const params = new URLSearchParams({ scopedWeekId });
  if (companyId) params.set('companyId', companyId);
  return request<{ logs: MigrationLogEntry[] }>(`/geovictoria/migration-logs?${params.toString()}`);
}

export type NotifyWhatsappScheduleResponse = {
  ok: true;
  to: string;
  payload: {
    to: string;
    variables: { nombre: string; phone: string; url: string; slug: string };
  };
};

export function notifyWhatsappSchedule(payload: {
  employeeId: string;
  weekStart: string;
  phoneOverride?: string;
}): Promise<NotifyWhatsappScheduleResponse> {
  return request<NotifyWhatsappScheduleResponse>('/notify/whatsapp-schedule', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
