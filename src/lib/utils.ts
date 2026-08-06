import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isAfter, subDays, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const MONTH_FILTER_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'August 2026', value: '2026-08' },
  { label: 'July 2026', value: '2026-07' },
  { label: 'June 2026', value: '2026-06' },
  { label: 'May 2026', value: '2026-05' },
  { label: 'April 2026', value: '2026-04' },
  { label: 'March 2026', value: '2026-03' },
  { label: 'February 2026', value: '2026-02' },
  { label: 'January 2026', value: '2026-01' },
  { label: 'Year 2025', value: '2025' },
];

export function matchesTimeFilter(dateInput: string | Date | null | undefined, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  if (!dateInput) return false;

  let d: Date;
  if (typeof dateInput === 'string') {
    d = parseISO(dateInput);
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) return false;

  const now = new Date();

  if (filter === 'today') {
    return format(d, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
  }

  if (filter === 'week') {
    return isAfter(d, subDays(now, 7));
  }

  if (filter === 'this_month' || filter === 'month') {
    return format(d, 'yyyy-MM') === format(now, 'yyyy-MM');
  }

  if (filter === 'last_month') {
    const lastMonth = subMonths(now, 1);
    return format(d, 'yyyy-MM') === format(lastMonth, 'yyyy-MM');
  }

  if (filter.length === 7 && filter.includes('-')) {
    // e.g. '2026-08'
    return format(d, 'yyyy-MM') === filter;
  }

  if (filter.length === 4) {
    // e.g. '2025'
    return format(d, 'yyyy') === filter;
  }

  return true;
}
