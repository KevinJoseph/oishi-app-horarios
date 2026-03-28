import type { SeedState } from '../data/seed';
import type { AreaId, ValidationRequirements } from '../types';
import { request } from './http';

export function fetchPlannerState(): Promise<SeedState> {
  return request<SeedState>('/state');
}

export function savePlannerState(payload: SeedState): Promise<SeedState> {
  return request<SeedState>('/state', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function saveValidationRequirements(payload: {
  areaId: AreaId;
  validationRequirements: ValidationRequirements;
}): Promise<SeedState> {
  return request<SeedState>('/state/validation-requirements', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function resetPlannerState(): Promise<SeedState> {
  return request<SeedState>('/state/reset', {
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
  userIdentifier: string;
  dateISO: string;
  startHour: string;
  endHour: string;
  breakStartHour?: string;
  breakEndHour?: string;
  custom: string;
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
