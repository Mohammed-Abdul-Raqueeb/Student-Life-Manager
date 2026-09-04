import type { Weekday } from "@/generated/prisma/enums";

import { inAppZone } from "@/lib/date";

/**
 * Weekday constants, in a module with no database imports.
 *
 * Client components (the timetable form, for one) need these as *values*, and a
 * value import from the query layer would drag the Postgres driver into the
 * browser bundle. They live here so both sides can use them; `src/lib/db/queries`
 * re-exports them for server code that already imports from there.
 */

export const WEEKDAY_ORDER: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

/**
 * The weekday an instant falls on, on the app's calendar.
 *
 * This drives the "today" highlight in the timetable, so it has to be read in
 * the student's zone: at 01:30 IST on a Friday a UTC host still reads Thursday
 * and would highlight the wrong row.
 */
export function weekdayFor(date: Date): Weekday {
  // getDay(): 0 = Sunday. WEEKDAY_ORDER starts at Monday.
  return WEEKDAY_ORDER[(inAppZone(date).getDay() + 6) % 7];
}
