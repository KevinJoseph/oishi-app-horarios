import { request } from './http';

export type BukRecinto = {
  companyId: string;
  code: string;
  name: string;
  attendanceEnabled: boolean;
  updatedAt: string;
};

export function fetchBukRecintos(): Promise<BukRecinto[]> {
  return request<BukRecinto[]>('/buk/recintos');
}

export function saveBukRecinto(
  companyId: string,
  payload: { code: string; name: string; attendanceEnabled: boolean }
): Promise<BukRecinto> {
  return request<BukRecinto>(`/buk/recintos/${encodeURIComponent(companyId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteBukRecinto(companyId: string): Promise<void> {
  return request<void>(`/buk/recintos/${encodeURIComponent(companyId)}`, {
    method: 'DELETE'
  });
}

export type BukRegisteredShift = {
  signature: string;
  code: string;
  name: string;
  areaLabel: string;
  start: string;
  end: string;
  nocturnal: boolean;
  recintoCodes: string[];
  createdAt: string;
  updatedAt: string;
};

export function fetchBukShifts(): Promise<BukRegisteredShift[]> {
  return request<BukRegisteredShift[]>('/buk/shifts');
}

export function registerBukShifts(
  shifts: Array<Omit<BukRegisteredShift, 'createdAt' | 'updatedAt'>>
): Promise<BukRegisteredShift[]> {
  return request<BukRegisteredShift[]>('/buk/shifts/register', {
    method: 'POST',
    body: JSON.stringify({ shifts })
  });
}
