import type { BreakConfig, TimeSlot } from '../types';

function parseTimeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function isTimeSlotInBreak(slot: TimeSlot, breakConfig: BreakConfig): boolean {
  if (!breakConfig.enabled) return false;
  const slotStart = parseTimeToMinutes(slot.start);
  const slotEnd = parseTimeToMinutes(slot.end);
  if (slotStart === null || slotEnd === null) return false;
  const breakStart = breakConfig.startHour * 60;
  const breakEnd = breakConfig.endHour * 60;
  return slotStart >= breakStart && slotEnd <= breakEnd;
}

export function getBreakTimeSlotIds(timeSlots: TimeSlot[], breakConfig: BreakConfig): Set<string> {
  const ids = new Set<string>();
  for (const slot of timeSlots) {
    if (isTimeSlotInBreak(slot, breakConfig)) {
      ids.add(slot.id);
    }
  }
  return ids;
}

export function getWorkableTimeSlots(timeSlots: TimeSlot[], breakConfig: BreakConfig): TimeSlot[] {
  return timeSlots.filter((slot) => !isTimeSlotInBreak(slot, breakConfig));
}
