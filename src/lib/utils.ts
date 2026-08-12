import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isAfter, subDays, subMonths, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const MONTH_FILTER_OPTIONS = [
  { label: 'All Time (All Records)', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month (August 2026)', value: 'this_month' },
  { label: 'Last Month (July 2026)', value: 'last_month' },
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

  let strVal = '';
  let dateObj: Date | null = null;

  if (typeof dateInput === 'string') {
    strVal = dateInput.trim();
    if (strVal.length >= 10) {
      const datePart = strVal.slice(0, 10);
      if (filter.length === 7 && filter.includes('-')) {
        return datePart.startsWith(filter);
      }
      if (filter.length === 4 && !isNaN(Number(filter))) {
        return datePart.startsWith(filter);
      }
    }
    dateObj = new Date(strVal);
  } else if (dateInput instanceof Date) {
    dateObj = dateInput;
    strVal = format(dateObj, 'yyyy-MM-dd');
  }

  if (!dateObj || isNaN(dateObj.getTime())) return false;

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const thisMonthStr = format(now, 'yyyy-MM');
  const lastMonthStr = format(subMonths(now, 1), 'yyyy-MM');

  if (filter === 'today') {
    return strVal.startsWith(todayStr);
  }

  if (filter === 'week') {
    const sevenDaysAgo = subDays(now, 7);
    return isAfter(dateObj, sevenDaysAgo);
  }

  if (filter === 'this_month' || filter === 'month') {
    return strVal.startsWith(thisMonthStr);
  }

  if (filter === 'last_month') {
    return strVal.startsWith(lastMonthStr);
  }

  if (filter.length === 7 && filter.includes('-')) {
    return strVal.startsWith(filter);
  }

  if (filter.length === 4) {
    return strVal.startsWith(filter);
  }

  return true;
}
