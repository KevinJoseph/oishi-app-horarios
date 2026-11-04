import { request } from './http';

export type SubAreaResponse = {
  id: string;
  companyId: string;
  areaCode: string;
  code: string;
  label: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

function companyQuery(companyId?: string | null): string {
  return companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
}

function base(areaCode: string): string {
  return `/areas/${encodeURIComponent(areaCode)}/subareas`;
}

export function fetchAllSubAreas(companyId?: string | null): Promise<SubAreaResponse[]> {
  return request<SubAreaResponse[]>(`/subareas${companyQuery(companyId)}`);
}

export function createSubArea(
  areaCode: string,
  payload: { label: string; order?: number },
  companyId?: string | null
): Promise<SubAreaResponse> {
  return request<SubAreaResponse>(`${base(areaCode)}${companyQuery(companyId)}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateSubArea(
  areaCode: string,
  code: string,
  payload: { label?: string; order?: number },
  companyId?: string | null
): Promise<SubAreaResponse> {
  return request<SubAreaResponse>(`${base(areaCode)}/${encodeURIComponent(code)}${companyQuery(companyId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteSubArea(areaCode: string, code: string, companyId?: string | null): Promise<void> {
  return request<void>(`${base(areaCode)}/${encodeURIComponent(code)}${companyQuery(companyId)}`, {
    method: 'DELETE'
  });
}
