import { format, parseISO, isValid } from 'date-fns';

export function formatDate(date: string | Date | null | undefined, pattern = 'dd MMM yyyy'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, pattern) : '—';
}

export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, 'dd MMM yyyy, HH:mm');
}

export function formatCurrency(value: number | null | undefined, currency = 'ETB'): string {
  if (value == null) return '—';
  return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function todayISODate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function monthKey(): string {
  return format(new Date(), 'yyyy-MM');
}

export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function roleLabel(role: string): string {
  return role
    .split('-')
    .map(capitalise)
    .join(' ');
}
