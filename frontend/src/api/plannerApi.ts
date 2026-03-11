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
