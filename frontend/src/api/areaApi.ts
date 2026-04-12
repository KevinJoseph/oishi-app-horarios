import type { AreaInfo } from '../types';
import { request } from './http';

export type AreaResponse = AreaInfo & {
  id: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
};

function companyQuery(companyId?: string | null): string {
  return companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
}

export function fetchAreas(companyId?: string | null): Promise<AreaResponse[]> {
  return request<AreaResponse[]>(`/areas${companyQuery(companyId)}`);
}

export function createArea(payload: { code: string; label: string; order?: number }, companyId?: string | null): Promise<AreaResponse> {
  return request<AreaResponse>(`/areas${companyQuery(companyId)}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateArea(code: string, payload: { label?: string; order?: number }, companyId?: string | null): Promise<AreaResponse> {
  return request<AreaResponse>(`/areas/${encodeURIComponent(code)}${companyQuery(companyId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteArea(code: string, companyId?: string | null): Promise<void> {
  return request<void>(`/areas/${encodeURIComponent(code)}${companyQuery(companyId)}`, {
    method: 'DELETE'
  });
}
