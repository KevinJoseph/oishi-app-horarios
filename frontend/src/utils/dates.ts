import { addDays, addWeeks, differenceInCalendarWeeks, endOfMonth, format, formatISO, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export function getCurrentMonday(): Date {
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

export function getCurrentWeekStartDateISO(): string {
  return formatISO(getCurrentMonday(), { representation: 'date' });
}

export function formatDayNameEs(dateISO: string): string {
  return capitalize(format(parseISO(dateISO), 'EEEE', { locale: es }));
}

export function buildWeekLabel(startDate: Date): string {
  const endDate = addDays(startDate, 6);
  return `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')}`;
}

export function buildRelativeWeekLabel(startDate: Date): string {
  const diff = differenceInCalendarWeeks(startDate, getCurrentMonday(), { weekStartsOn: 1 });
  if (diff === 0) return 'Semana actual';
  if (diff > 0) return 'Semana siguiente';
  return 'Semana anterior';
}

export function buildMonthLabel(date: Date): string {
  return capitalize(format(date, 'LLLL yyyy', { locale: es }));
}

export function getMonthStartDate(date: Date): Date {
  return startOfMonth(date);
}

export function getMonthWeeks(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weeks: Date[] = [];

  for (let cursor = firstWeekStart; cursor <= monthEnd; cursor = addWeeks(cursor, 1)) {
    if (cursor < monthStart) continue;
    weeks.push(cursor);
  }

  return weeks;
}

function capitalize(value: string): string {
  if (!value.length) return value;
  return value[0].toUpperCase() + value.slice(1);
}
