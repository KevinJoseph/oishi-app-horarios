import type { DayPlan, Employee, TimeSlot } from '../types';
import { isWorkAssignment } from './assignments';

function countAssigned(dayPlan: DayPlan, slotIds: string[], employeeIds: Set<string>): number {
  let count = 0;
  for (const slotId of slotIds) {
    const row = dayPlan.assignments[slotId];
    if (!row) continue;
    for (const [employeeId, assignment] of Object.entries(row)) {
      if (!employeeIds.has(employeeId)) continue;
      if (isWorkAssignment(assignment)) count += 1;
    }
  }
  return count;
}

export function getOpeningClosingSummary(
  dayPlan: DayPlan,
  timeSlots: TimeSlot[],
  employees: Employee[]
): { opening: number; closing: number } {
  const ordered = [...timeSlots].sort((a, b) => a.order - b.order);
  const visibleEmployeeIds = new Set(
    employees
      .filter((employee) => employee.active && employee.applyOpeningClosingRules !== false)
      .map((employee) => employee.id)
  );
  const openingSlots = ordered.length ? [ordered[0].id] : [];
  const closingSlots = ordered.length ? [ordered[ordered.length - 1].id] : [];
  return {
    opening: countAssigned(dayPlan, openingSlots, visibleEmployeeIds),
    closing: countAssigned(dayPlan, closingSlots, visibleEmployeeIds)
  };
}
