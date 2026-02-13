import type { DayPlan, TimeSlot } from '../types';

function countAssigned(dayPlan: DayPlan, slotIds: string[]): number {
  let count = 0;
  for (const slotId of slotIds) {
    const row = dayPlan.assignments[slotId];
    if (!row) continue;
    for (const assignment of Object.values(row)) {
      if (assignment.code !== 'LIBRE') count += 1;
    }
  }
  return count;
}

export function getOpeningClosingSummary(dayPlan: DayPlan, timeSlots: TimeSlot[]): { opening: number; closing: number } {
  const ordered = [...timeSlots].sort((a, b) => a.order - b.order);
  const openingSlots = ordered.slice(0, 2).map((slot) => slot.id);
  const closingSlots = ordered.slice(-2).map((slot) => slot.id);
  return {
    opening: countAssigned(dayPlan, openingSlots),
    closing: countAssigned(dayPlan, closingSlots)
  };
}
