import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export function getCurrentMonday(): Date {
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

export function formatDayNameEs(dateISO: string): string {
  return capitalize(format(parseISO(dateISO), 'EEEE', { locale: es }));
}

export function buildWeekLabel(startDate: Date): string {
  const endDate = addDays(startDate, 6);
  return `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')}`;
}

function capitalize(value: string): string {
  if (!value.length) return value;
  return value[0].toUpperCase() + value.slice(1);
}
