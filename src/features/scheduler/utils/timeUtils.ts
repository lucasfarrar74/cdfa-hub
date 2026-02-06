import type { TimeSlot, EventConfig } from '../types';
import { parse, format, addMinutes, addDays, isBefore, isAfter, parseISO } from 'date-fns';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function parseTimeString(dateStr: string, timeStr: string): Date {
  return parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
}

export function formatTime(date: Date): string {
  return format(date, 'h:mm a');
}

export function formatTimeShort(date: Date): string {
  return format(date, 'HH:mm');
}

/**
 * Get an array of date strings from startDate to endDate (inclusive)
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = parseISO(startDate);
  const end = parseISO(endDate);

  while (!isAfter(current, end)) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }

  return dates;
}

/**
 * Generate time slots for a single day
 */
function generateDaySlots(eventDate: string, config: EventConfig): TimeSlot[] {
  const slots: TimeSlot[] = [];

  let currentTime = parseTimeString(eventDate, config.startTime);
  const endTime = parseTimeString(eventDate, config.endTime);

  // Sort breaks by start time
  const sortedBreaks = [...config.breaks].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  while (isBefore(currentTime, endTime)) {
    // Check if current time falls within a break (exclusive of end time to avoid infinite loop)
    const activeBreak = sortedBreaks.find(brk => {
      const breakStart = parseTimeString(eventDate, brk.startTime);
      const breakEnd = parseTimeString(eventDate, brk.endTime);
      // Use isBefore for end check to exclude the endpoint (avoids infinite loop at break end)
      const withinBreak = !isBefore(currentTime, breakStart) && isBefore(currentTime, breakEnd);
      const wouldOverlapBreak = isBefore(currentTime, breakStart) && isAfter(addMinutes(currentTime, config.defaultMeetingDuration), breakStart);
      return withinBreak || wouldOverlapBreak;
    });

    if (activeBreak) {
      const breakStart = parseTimeString(eventDate, activeBreak.startTime);
      const breakEnd = parseTimeString(eventDate, activeBreak.endTime);

      // If we haven't reached the break yet, create a slot before it
      if (isBefore(currentTime, breakStart)) {
        const slotEnd = breakStart;
        if (isBefore(currentTime, slotEnd)) {
          slots.push({
            id: generateId(),
            date: eventDate,
            startTime: currentTime,
            endTime: slotEnd,
            isBreak: false,
          });
        }
      }

      // Add the break slot
      slots.push({
        id: generateId(),
        date: eventDate,
        startTime: breakStart,
        endTime: breakEnd,
        isBreak: true,
        breakName: activeBreak.name,
      });

      currentTime = breakEnd;
    } else {
      // Regular meeting slot
      const slotEnd = addMinutes(currentTime, config.defaultMeetingDuration);

      // Check if this slot would overlap with a break
      const nextBreak = sortedBreaks.find(brk => {
        const breakStart = parseTimeString(eventDate, brk.startTime);
        return isAfter(breakStart, currentTime) && isBefore(breakStart, slotEnd);
      });

      if (nextBreak) {
        const breakStart = parseTimeString(eventDate, nextBreak.startTime);
        if (isBefore(currentTime, breakStart)) {
          slots.push({
            id: generateId(),
            date: eventDate,
            startTime: currentTime,
            endTime: breakStart,
            isBreak: false,
          });
        }
        currentTime = breakStart;
      } else {
        const actualEnd = isBefore(slotEnd, endTime) ? slotEnd : endTime;
        slots.push({
          id: generateId(),
          date: eventDate,
          startTime: currentTime,
          endTime: actualEnd,
          isBreak: false,
        });
        currentTime = actualEnd;
      }
    }
  }

  return slots.filter(slot => !slot.isBreak || slot.breakName);
}

/**
 * Generate time slots for all days in the event
 */
export function generateTimeSlots(config: EventConfig): TimeSlot[] {
  const dates = getDateRange(config.startDate, config.endDate);
  const allSlots: TimeSlot[] = [];

  for (const dateStr of dates) {
    const daySlots = generateDaySlots(dateStr, config);
    allSlots.push(...daySlots);
  }

  return allSlots;
}

export function getSlotDuration(slot: TimeSlot): number {
  return (slot.endTime.getTime() - slot.startTime.getTime()) / (1000 * 60);
}

/**
 * Format a date string (YYYY-MM-DD) to a readable format
 */
export function formatDateReadable(dateStr: string): string {
  return format(parseISO(dateStr), 'EEE, MMM d, yyyy');
}

/**
 * Format a date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return formatDateReadable(startDate);
  }
  return `${format(parseISO(startDate), 'MMM d')} - ${format(parseISO(endDate), 'MMM d, yyyy')}`;
}

/**
 * Get unique dates from time slots
 */
export function getUniqueDatesFromSlots(slots: TimeSlot[]): string[] {
  const dates = new Set(slots.map(s => s.date));
  return Array.from(dates).sort();
}
