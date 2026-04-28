export const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' }
];

export function normalizeRestDay(value: number | undefined): number {
  if (typeof value !== 'number' || value < 0 || value > 6) return 0;
  return value;
}

export function getRestDayLabel(value: number | undefined): string {
  const normalized = normalizeRestDay(value);
  return WEEKDAY_OPTIONS.find((item) => item.value === normalized)?.label ?? 'Domingo';
}

export function isRestDayForDate(dateISO: string, restDay: number | undefined): boolean {
  const normalized = normalizeRestDay(restDay);
  const date = new Date(`${dateISO}T00:00:00`);
  return date.getDay() === normalized;
}

export function normalizeRestDayList(value: number | number[] | undefined): number[] {
  if (value === undefined || value === null) return [];
  const arr = Array.isArray(value) ? value : [value];
  const out: number[] = [];
  for (const v of arr) {
    if (typeof v !== 'number' || v < 0 || v > 6) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export function isAnyRestDayForDate(dateISO: string, restDays: number[] | undefined): boolean {
  if (!restDays || restDays.length === 0) return false;
  const dow = new Date(`${dateISO}T00:00:00`).getDay();
  return restDays.includes(dow);
}
