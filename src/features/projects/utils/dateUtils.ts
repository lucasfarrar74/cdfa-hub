import {
  format,
  parseISO,
  addDays,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfDay,
} from 'date-fns';

export {
  format,
  parseISO,
  addDays,
  differenceInDays,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfDay,
};

// Generate weeks for a month view calendar
export function generateMonthWeeks(date: Date): Date[][] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks: Date[][] = [];

  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return weeks;
}

// Get all dates in a range (inclusive)
export function getDateRange(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days = eachDayOfInterval({ start, end });
  return days.map((d) => format(d, 'yyyy-MM-dd'));
}

// Format date for display
export function formatDisplayDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d');
}

// Get current date in YYYY-MM-DD format
export function getCurrentDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// Check if a date is today
export function isToday(dateStr: string): boolean {
  return isSameDay(parseISO(dateStr), new Date());
}

// Check if a date is in the past
export function isPast(dateStr: string): boolean {
  return isBefore(parseISO(dateStr), startOfDay(new Date()));
}

// Check if a date is in the future
export function isFuture(dateStr: string): boolean {
  return isAfter(parseISO(dateStr), startOfDay(new Date()));
}

// Get days until a date
export function getDaysUntil(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), startOfDay(new Date()));
}

// Get days since a date
export function getDaysSince(dateStr: string): number {
  return differenceInDays(startOfDay(new Date()), parseISO(dateStr));
}

// Check if activity spans a specific date
export function activitySpansDate(
  startDate: string,
  endDate: string,
  targetDate: string
): boolean {
  const target = parseISO(targetDate);
  return isWithinInterval(target, {
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
}

// Generate time units for timeline view
export type TimeZoom = 'week' | 'month' | 'quarter';

export interface TimeUnit {
  label: string;
  startDate: Date;
  endDate: Date;
  isCurrentPeriod: boolean;
}

export function generateTimeUnits(
  startDate: Date,
  endDate: Date,
  zoom: TimeZoom
): TimeUnit[] {
  const units: TimeUnit[] = [];
  const today = new Date();
  let current = new Date(startDate);

  while (current <= endDate) {
    let unitEnd: Date;
    let label: string;

    switch (zoom) {
      case 'week':
        unitEnd = addDays(current, 6);
        label = `${format(current, 'MMM d')} - ${format(unitEnd, 'MMM d')}`;
        break;
      case 'month':
        unitEnd = endOfMonth(current);
        label = format(current, 'MMM yyyy');
        current = startOfMonth(current);
        break;
      case 'quarter':
        const quarter = Math.floor(current.getMonth() / 3);
        const quarterStart = new Date(current.getFullYear(), quarter * 3, 1);
        unitEnd = new Date(current.getFullYear(), (quarter + 1) * 3, 0);
        label = `Q${quarter + 1} ${format(quarterStart, 'yyyy')}`;
        current = quarterStart;
        break;
    }

    units.push({
      label,
      startDate: new Date(current),
      endDate: unitEnd,
      isCurrentPeriod: isWithinInterval(today, { start: current, end: unitEnd }),
    });

    // Move to next unit
    switch (zoom) {
      case 'week':
        current = addDays(current, 7);
        break;
      case 'month':
        current = addDays(endOfMonth(current), 1);
        break;
      case 'quarter':
        current = addDays(unitEnd, 1);
        break;
    }
  }

  return units;
}
