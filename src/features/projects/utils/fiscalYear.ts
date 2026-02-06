import { parseISO } from 'date-fns';

// California State fiscal year runs July 1 - June 30
export function getFiscalYear(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  // If July or later, fiscal year is current year - next year
  // If before July, fiscal year is previous year - current year
  if (month >= 6) {
    // July = 6
    return `FY${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `FY${year - 1}-${year.toString().slice(-2)}`;
  }
}

export function getFiscalYearFromDateString(dateStr: string): string {
  return getFiscalYear(parseISO(dateStr));
}

// Get fiscal year start and end dates
export function getFiscalYearDates(fiscalYear: string): { start: Date; end: Date } {
  // Parse FY2024-25 format
  const match = fiscalYear.match(/FY(\d{4})-(\d{2})/);
  if (!match) {
    throw new Error(`Invalid fiscal year format: ${fiscalYear}`);
  }

  const startYear = parseInt(match[1], 10);
  return {
    start: new Date(startYear, 6, 1), // July 1
    end: new Date(startYear + 1, 5, 30), // June 30
  };
}

// Get list of fiscal years (for dropdown)
export function getFiscalYearOptions(yearsBack: number = 2, yearsForward: number = 2): string[] {
  const currentFY = getFiscalYear();
  const match = currentFY.match(/FY(\d{4})/);
  if (!match) return [currentFY];

  const currentStartYear = parseInt(match[1], 10);
  const options: string[] = [];

  for (let i = -yearsBack; i <= yearsForward; i++) {
    const year = currentStartYear + i;
    options.push(`FY${year}-${(year + 1).toString().slice(-2)}`);
  }

  return options;
}

// Format fiscal year for display
export function formatFiscalYearDisplay(fiscalYear: string): string {
  // Convert FY2024-25 to Fiscal Year 2024-25
  return fiscalYear.replace('FY', 'Fiscal Year ');
}

// Check if a date is within a fiscal year
export function isInFiscalYear(dateStr: string, fiscalYear: string): boolean {
  const date = parseISO(dateStr);
  const { start, end } = getFiscalYearDates(fiscalYear);
  return date >= start && date <= end;
}
