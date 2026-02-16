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
  // La grilla diaria oculta el primer bloque horario por regla de negocio.
  // "Apertura" debe usar el primer bloque visible para mantener consistencia visual.
  const firstVisible = ordered.length > 1 ? ordered[1] : ordered[0];
  const openingSlots = firstVisible ? [firstVisible.id] : [];
  const closingSlots = ordered.length ? [ordered[ordered.length - 1].id] : [];
  return {
    opening: countAssigned(dayPlan, openingSlots),
    closing: countAssigned(dayPlan, closingSlots)
  };
}
