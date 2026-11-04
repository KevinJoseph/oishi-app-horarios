import { request } from './http';

export type EmployeeDirectoryEntry = {
  id: string;
  name: string;
  active: boolean;
  areaId?: string;
  companyId?: string;
  companyLabel?: string;
};

/** Every employee across all companies and areas (minimal fields). */
export function fetchEmployeeDirectory(): Promise<EmployeeDirectoryEntry[]> {
  return request<EmployeeDirectoryEntry[]>('/employees/directory');
}
