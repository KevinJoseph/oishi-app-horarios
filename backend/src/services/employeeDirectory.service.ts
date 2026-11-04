import { EmployeeModel } from '../models/Employee.js';

export type EmployeeDirectoryEntry = {
  id: string;
  name: string;
  active: boolean;
  areaId?: string;
  companyId?: string;
  companyLabel?: string;
};

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** Lightweight list of every employee across all companies (used e.g. for the supervisor picker). */
export async function listEmployeeDirectory(): Promise<EmployeeDirectoryEntry[]> {
  const docs = await EmployeeModel.find(
    {},
    {
      baseEmployeeId: 1,
      'data.id': 1,
      'data.name': 1,
      'data.active': 1,
      'data.areaId': 1,
      'data.companyId': 1,
      'data.moduleCompanyId': 1,
      'data.moduleCompanyAlias': 1,
      'data.moduleCompanyName': 1,
      'data.companyAlias': 1,
      'data.companyName': 1
    }
  ).lean();

  const byId = new Map<string, EmployeeDirectoryEntry>();
  for (const doc of docs) {
    const data = (doc.data ?? {}) as Record<string, unknown>;
    const id = str(data.id) ?? doc.baseEmployeeId;
    const name = str(data.name);
    if (!id || !name || byId.has(id)) continue;
    byId.set(id, {
      id,
      name,
      active: data.active !== false,
      areaId: str(data.areaId),
      companyId: str(data.moduleCompanyId) ?? str(data.companyId),
      companyLabel:
        str(data.moduleCompanyName) ?? str(data.companyName) ?? str(data.moduleCompanyAlias) ?? str(data.companyAlias)
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
