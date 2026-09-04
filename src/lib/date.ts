import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfDay,
  startOfWeek,
} from "date-fns";

/**
 * Date and time handling, in one place.
 *
 * There are two kinds of temporal value in this app and they are handled
 * differently on purpose:
 *
 *  - **Instants** (`dueDate`, `examDate`, `startedAt`) are stored as timestamps.
 *    They are read and written as real `Date` objects and interpreted in the
 *    server's timezone, which the deployment pins with the `TZ` env var.
 *
 *  - **Calendar dates** (`AttendanceRecord.date`, `Assessment.date`) are stored
 *    in Postgres `date` columns. Prisma hands those back as a `Date` at *UTC*
 *    midnight, so they must be read and written with UTC accessors — never with
 *    local ones, or the value drifts by a day either side of the meridian.
 *
 * Everything user-visible is formatted on the server and passed to client
 * components as a plain string, so there is no clock to disagree about at
 * hydration time.
 */

/** Monday. Indian and most European academic weeks start there. */
export const WEEK_STARTS_ON = 1 as const;

// ── Calendar dates (Postgres `date`) ─────────────────────────────────────────

/** Parse a `<input type="date">` value into the UTC-midnight `Date` a `date` column wants. */
export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return isValid(parsed) ? parsed : null;
}

/** Format a `date`-column value back into a `<input type="date">` value. */
export function formatCalendarDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today, as the UTC-midnight `Date` used for `date` columns. */
export function todayAsCalendarDate(now: Date = new Date()): Date {
  return new Date(`${format(now, "yyyy-MM-dd")}T00:00:00.000Z`);
}

/** Human label for a `date`-column value, e.g. "Sep 3, 2026". */
export function formatCalendarDate(date: Date, pattern = "MMM d, yyyy"): string {
  // Shift the UTC-midnight value into local time so the formatter reads the
  // same calendar day it was stored as.
  const shifted = new Date(date.getTime() + date.getTimezoneOffset() * 60_000);
  return format(shifted, pattern);
}

// ── Instants (Postgres `timestamp`) ──────────────────────────────────────────

/** Combine `<input type="date">` + `<input type="time">` into a local instant. */
export function parseLocalDateTime(
  dateValue: string,
  timeValue: string,
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const time = /^\d{2}:\d{2}$/.test(timeValue) ? timeValue : "00:00";
  const parsed = parse(
    `${dateValue} ${time}`,
    "yyyy-MM-dd HH:mm",
    new Date(),
  );
  return isValid(parsed) ? parsed : null;
}

export function formatDateInput(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatTimeInput(date: Date): string {
  return format(date, "HH:mm");
}

export function formatDateTime(date: Date): string {
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

export function formatDate(date: Date, pattern = "MMM d, yyyy"): string {
  return format(date, pattern);
}

export function formatTime(date: Date): string {
  return format(date, "h:mm a");
}

// ── Day and week windows ─────────────────────────────────────────────────────

export function dayRange(date: Date): { start: Date; end: Date } {
  return { start: startOfDay(date), end: endOfDay(date) };
}

export function weekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }),
  };
}

export function weekDays(date: Date): Date[] {
  const { start } = weekRange(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ── Wall-clock strings ("HH:mm", used by the timetable) ──────────────────────

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidClockTime(value: string): boolean {
  return HHMM.test(value);
}

export function clockToMinutes(value: string): number {
  const match = HHMM.exec(value);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "14:30" → "2:30 PM". Falls back to the raw value if it is not a clock time. */
export function formatClockTime(value: string): string {
  if (!HHMM.test(value)) return value;
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

// ── Labels ───────────────────────────────────────────────────────────────────

/** "11h 30m", "45m", "0m". Negative input is clamped to zero. */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Relative label for a due date: "Today", "Tomorrow", "In 3 days", "2 days ago",
 * or an absolute date once it is far enough away to stop being useful.
 */
export function relativeDayLabel(target: Date, now: Date = new Date()): string {
  const days = differenceInCalendarDays(target, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days <= 13) return `In ${days} days`;
  if (days < -1 && days >= -13) return `${Math.abs(days)} days ago`;
  return format(target, days > 0 && isSameYear(target, now) ? "MMM d" : "MMM d, yyyy");
}

function isSameYear(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear();
}

/** Whole calendar days from `now` until `target`. Negative once it is past. */
export function daysUntil(target: Date, now: Date = new Date()): number {
  return differenceInCalendarDays(target, now);
}

/**
 * Countdown for an exam or deadline. Switches to hours inside the last day so
 * "Today" never hides the fact that something starts in 40 minutes.
 */
export function countdownLabel(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "Completed";

  const days = differenceInCalendarDays(target, now);
  if (days >= 2) return `${days} days left`;
  if (days === 1) return "Tomorrow";

  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 2) return `${hours} hours left`;
  if (hours === 1) return "1 hour left";

  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes} min left`;
}
