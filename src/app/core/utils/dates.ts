// Dates are stored as yyyy-mm-dd strings and handled as local calendar days, so a tour that
// starts on 12 Jun shows 12 Jun everywhere regardless of the time zone.

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayIso = (): string => toIsoDate(new Date());

function parse(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = parse(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parse(toIso).getTime() - parse(fromIso).getTime()) / 86_400_000);
}

const dayMonthYear = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dayMonth = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const monthYear = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });

// 12 Jun 2027
export const formatDate = (iso: string): string => (iso ? dayMonthYear.format(parse(iso)) : '');

// June 2027
export const formatMonth = (iso: string): string => monthYear.format(parse(iso));

// Sat
export const formatWeekday = (iso: string): string => weekday.format(parse(iso));

// 12 Jun – 19 Jun 2027, or 28 Jun 2027 – 4 Jul 2027 across years
export function formatRange(startIso: string, endIso: string): string {
  const sameYear = startIso.slice(0, 4) === endIso.slice(0, 4);
  const start = sameYear ? dayMonth.format(parse(startIso)) : formatDate(startIso);
  return `${start} – ${formatDate(endIso)}`;
}
