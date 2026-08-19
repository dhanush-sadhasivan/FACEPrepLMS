/**
 * FACEPrep LMS — Internal Training Calendar & Working Days Utilities
 */

/**
 * Convert Date object to ISO date string (YYYY-MM-DD) in local time
 */
export function formatISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD into a local Date object at midnight
 */
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Returns ISO weekday number: 1 (Mon) to 7 (Sun)
 */
export function getISOWeekday(date: Date): number {
  const day = date.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  return day === 0 ? 7 : day;
}

/**
 * Checks if a given date is in the allowed working days array (1=Mon ... 7=Sun)
 */
export function isWorkingDay(date: Date, workingDays: number[]): boolean {
  if (!workingDays || workingDays.length === 0) return true;
  const isoDay = getISOWeekday(date);
  return workingDays.includes(isoDay);
}

/**
 * Calculate the calendar date for a specific dayNumber (1-based)
 * starting from startDateStr (YYYY-MM-DD).
 */
export function calculateDateForDayNumber(
  startDateStr: string,
  dayNumber: number,
  workingDays: number[] = [1, 2, 3, 4, 5]
): string {
  let curr = parseISODate(startDateStr);

  // If start date itself is not a working day, advance to the first working day
  while (!isWorkingDay(curr, workingDays)) {
    curr.setDate(curr.getDate() + 1);
  }

  let count = 1;
  while (count < dayNumber) {
    curr.setDate(curr.getDate() + 1);
    if (isWorkingDay(curr, workingDays)) {
      count++;
    }
  }

  return formatISODate(curr);
}

/**
 * Compute the current dayNumber (1-based) for today given a start date.
 * If today is before startDate, returns 1.
 * If today falls on a non-working day, returns the day number of the most recent prior working day (or next working day).
 */
export function computeCurrentDayNumber(
  startDateStr: string,
  todayStr: string,
  workingDays: number[] = [1, 2, 3, 4, 5]
): number {
  const start = parseISODate(startDateStr);
  const today = parseISODate(todayStr);

  if (today.getTime() <= start.getTime()) {
    return 1;
  }

  let curr = new Date(start);
  // Ensure start is on a working day
  while (!isWorkingDay(curr, workingDays) && curr.getTime() <= today.getTime()) {
    curr.setDate(curr.getDate() + 1);
  }

  if (curr.getTime() > today.getTime()) {
    return 1;
  }

  let dayCount = 1;
  while (curr.getTime() < today.getTime()) {
    curr.setDate(curr.getDate() + 1);
    if (isWorkingDay(curr, workingDays)) {
      dayCount++;
    }
  }

  return dayCount;
}

/**
 * Generate calculated dates for all day entries in a plan
 */
export function attachDatesToDayPlans<T extends { day_number: number }>(
  dayPlans: T[],
  startDateStr: string,
  workingDays: number[] = [1, 2, 3, 4, 5]
): (T & { calculated_date: string })[] {
  return dayPlans.map((dp) => ({
    ...dp,
    calculated_date: calculateDateForDayNumber(startDateStr, dp.day_number, workingDays),
  }));
}
