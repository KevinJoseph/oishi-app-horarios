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
  PositionDescription: string;
  Enabled: string;
  IntegrationCode: string;
}

export function fetchGeoVictoriaEmployees(): Promise<GeoVictoriaEmployee[]> {
  return request<GeoVictoriaEmployee[]>('/geovictoria/employees');
}

export function fetchGeoVictoriaReciboEmployees(): Promise<GeoVictoriaEmployee[]> {
  return request<GeoVictoriaEmployee[]>('/geovictoria/recibo-employees');
}

export type GeoVictoriaAddUserPayload = {
  identifier: string;
  email: string;
  name: string;
  lastName: string;
};

export function sendEmployeeToGeoVictoria(payload: GeoVictoriaAddUserPayload): Promise<{ message?: string }> {
  return request<{ message?: string }>('/geovictoria/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
