import type { Weekday } from "@/generated/prisma/enums";

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

export function weekdayFor(date: Date): Weekday {
  // getDay(): 0 = Sunday. WEEKDAY_ORDER starts at Monday.
  return WEEKDAY_ORDER[(date.getDay() + 6) % 7];
}
