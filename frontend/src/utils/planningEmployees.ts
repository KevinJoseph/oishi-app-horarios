import type { Employee, WeekPlan } from '../types';

/**
 * Colaboradores de la planificación de una semana. Si la semana está validada, los que
 * ya estaban desactivados al validar no se muestran y el resto se trata como activo
 * (los desactivados después de validar se mantienen como registro histórico).
 */
export function resolvePlanningEmployees(
  employees: Employee[],
  isValidated: boolean,
  inactiveEmployeeIds: string[] | undefined
): Employee[] {
  if (isValidated && inactiveEmployeeIds) {
    const inactiveSet = new Set(inactiveEmployeeIds);
    return employees
      .filter((employee) => !inactiveSet.has(employee.id))
      .map((employee) => ({ ...employee, active: true }));
  }
  return employees;
}

function hasRealAssignments(employeeId: string, weekPlan: WeekPlan | undefined): boolean {
  if (!weekPlan) return false;
  return weekPlan.days.some((day) =>
    Object.values(day.assignments).some((row) => {
      const assignment = row[employeeId];
      return Boolean(assignment && assignment.roleId !== null);
    })
  );
}

/**
 * Misma regla que la grilla (DayGrid con showInactiveEmployees en semanas validadas):
 * activos, más los inactivos con asignaciones reales si la semana está validada.
 */
export function isVisibleInPlanning(employee: Employee, weekPlan: WeekPlan | undefined, isValidated: boolean): boolean {
  if (employee.active) return true;
  return isValidated && hasRealAssignments(employee.id, weekPlan);
}
