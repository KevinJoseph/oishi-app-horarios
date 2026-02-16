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
