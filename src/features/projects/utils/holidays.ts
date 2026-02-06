import { format, getDay, addDays } from 'date-fns';

export interface Holiday {
  date: string; // yyyy-MM-dd format
  name: string;
  shortName: string;
}

/**
 * Get the nth occurrence of a weekday in a month
 * @param year - The year
 * @param month - The month (0-indexed)
 * @param weekday - The day of the week (0 = Sunday, 1 = Monday, etc.)
 * @param n - Which occurrence (1 = first, 2 = second, etc., -1 = last)
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  if (n === -1) {
    // Last occurrence - start from the end of the month
    const lastDay = new Date(year, month + 1, 0);
    const lastDayWeekday = getDay(lastDay);
    let diff = lastDayWeekday - weekday;
    if (diff < 0) diff += 7;
    return addDays(lastDay, -diff);
  }

  // First day of the month
  const firstDay = new Date(year, month, 1);
  const firstDayWeekday = getDay(firstDay);

  // Calculate the first occurrence of the weekday
  let diff = weekday - firstDayWeekday;
  if (diff < 0) diff += 7;

  // Add weeks to get to the nth occurrence
  const result = addDays(firstDay, diff + (n - 1) * 7);
  return result;
}

/**
 * Get California State Employee holidays for a given year
 * Reference: https://www.calhr.ca.gov/employees/Pages/state-holidays.aspx
 */
export function getCAStateHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [];

  // New Year's Day - January 1
  holidays.push({
    date: `${year}-01-01`,
    name: "New Year's Day",
    shortName: "New Year",
  });

  // Martin Luther King Jr. Day - 3rd Monday of January
  const mlkDay = getNthWeekdayOfMonth(year, 0, 1, 3);
  holidays.push({
    date: format(mlkDay, 'yyyy-MM-dd'),
    name: "Martin Luther King Jr. Day",
    shortName: "MLK Day",
  });

  // President's Day - 3rd Monday of February
  const presidentsDay = getNthWeekdayOfMonth(year, 1, 1, 3);
  holidays.push({
    date: format(presidentsDay, 'yyyy-MM-dd'),
    name: "President's Day",
    shortName: "Presidents",
  });

  // Cesar Chavez Day - March 31
  holidays.push({
    date: `${year}-03-31`,
    name: "Cesar Chavez Day",
    shortName: "Chavez Day",
  });

  // Memorial Day - Last Monday of May
  const memorialDay = getNthWeekdayOfMonth(year, 4, 1, -1);
  holidays.push({
    date: format(memorialDay, 'yyyy-MM-dd'),
    name: "Memorial Day",
    shortName: "Memorial",
  });

  // Independence Day - July 4
  holidays.push({
    date: `${year}-07-04`,
    name: "Independence Day",
    shortName: "July 4th",
  });

  // Labor Day - 1st Monday of September
  const laborDay = getNthWeekdayOfMonth(year, 8, 1, 1);
  holidays.push({
    date: format(laborDay, 'yyyy-MM-dd'),
    name: "Labor Day",
    shortName: "Labor Day",
  });

  // Indigenous Peoples' Day - 2nd Monday of October
  const indigenousPeoplesDay = getNthWeekdayOfMonth(year, 9, 1, 2);
  holidays.push({
    date: format(indigenousPeoplesDay, 'yyyy-MM-dd'),
    name: "Indigenous Peoples' Day",
    shortName: "Indigenous",
  });

  // Veterans Day - November 11
  holidays.push({
    date: `${year}-11-11`,
    name: "Veterans Day",
    shortName: "Veterans",
  });

  // Thanksgiving Day - 4th Thursday of November
  const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4);
  holidays.push({
    date: format(thanksgiving, 'yyyy-MM-dd'),
    name: "Thanksgiving Day",
    shortName: "Thanksgiving",
  });

  // Day after Thanksgiving - 4th Friday of November
  const dayAfterThanksgiving = addDays(thanksgiving, 1);
  holidays.push({
    date: format(dayAfterThanksgiving, 'yyyy-MM-dd'),
    name: "Day after Thanksgiving",
    shortName: "Fri Thanksgiving",
  });

  // Christmas Day - December 25
  holidays.push({
    date: `${year}-12-25`,
    name: "Christmas Day",
    shortName: "Christmas",
  });

  return holidays;
}

/**
 * Get holidays for a range of years
 */
export function getHolidaysForYears(startYear: number, endYear: number): Map<string, Holiday> {
  const holidayMap = new Map<string, Holiday>();

  for (let year = startYear; year <= endYear; year++) {
    const holidays = getCAStateHolidays(year);
    holidays.forEach((holiday) => {
      holidayMap.set(holiday.date, holiday);
    });
  }

  return holidayMap;
}

/**
 * Check if a date string is a CA State holiday
 */
export function isHoliday(dateStr: string, holidayMap: Map<string, Holiday>): Holiday | undefined {
  return holidayMap.get(dateStr);
}
