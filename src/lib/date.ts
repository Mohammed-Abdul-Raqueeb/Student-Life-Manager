import { TZDate } from "@date-fns/tz";
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  format,
  isValid,
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
 *    They are read and written as real `Date` objects — a genuine point in time,
 *    the same number everywhere on earth.
 *
 *  - **Calendar dates** (`AttendanceRecord.date`, `Assessment.date`) are stored
 *    in Postgres `date` columns. Prisma hands those back as a `Date` at *UTC*
 *    midnight, so they must be read and written with UTC accessors — never with
 *    local ones, or the value drifts by a day either side of the meridian.
 *
 * ## Why the timezone is pinned in code
 *
 * Turning an instant into a *calendar day* ("is this overdue today?", "which
 * timetable row is highlighted?") is only meaningful relative to a timezone.
 * date-fns reads the host's zone by default, which on a serverless host is UTC.
 * Under UTC, an instant at 2026-09-03 20:00Z is "September 3" — but the student
 * looking at their phone in India sees 01:30 on **September 4**. Every countdown,
 * every "Today", and every overdue badge would be a day out for the five and a
 * half hours after 18:30 IST, every single day.
 *
 * The obvious fix is the `TZ` environment variable, but Vercel reserves it and
 * refuses to let it be set. So the zone is pinned here instead, in the
 * application, and every calendar-day decision routes through {@link inAppZone}.
 * That is strictly better than depending on `TZ` anyway: correctness no longer
 * rests on how the process happened to be launched, so a laptop in any zone, CI,
 * and production all agree on what day it is.
 *
 * Instants are deliberately *not* rewritten — `new Date()` is already
 * zone-independent, and a stored timestamp is correct as it stands. Only the
 * reading of an instant as a civil date is zoned.
 *
 * Everything user-visible is formatted on the server and passed to client
 * components as a plain string, so there is no clock to disagree about at
 * hydration time.
 */

/**
 * The calendar the app reasons in. Every "today", weekday and countdown is
 * evaluated here regardless of the host's clock.
 *
 * Changing this one line moves the whole application to another zone. It is not
 * read from the environment on purpose: a server and a browser that disagreed
 * about the value would disagree about what day it is.
 */
export const APP_TIME_ZONE = "Asia/Kolkata";

/** Monday. Indian and most European academic weeks start there. */
export const WEEK_STARTS_ON = 1 as const;

// ── Zone plumbing ────────────────────────────────────────────────────────────

/**
 * The same instant, read through {@link APP_TIME_ZONE}'s accessors.
 *
 * `TZDate` is a `Date` subclass whose `getHours`, `getDay`, `getFullYear` and
 * friends answer in its zone, so any date-fns function handed one does its
 * arithmetic on the correct civil calendar. `getTime()` is untouched, so the
 * underlying instant never moves.
 */
export function inAppZone(instant: Date): TZDate {
  return new TZDate(instant, APP_TIME_ZONE);
}

/**
 * Drop the zone wrapper.
 *
 * A `TZDate` serialises with an offset suffix rather than `Z`, so values headed
 * for Prisma or a props payload are narrowed back to a plain `Date` carrying the
 * identical instant.
 */
function plain(date: Date): Date {
  return new Date(date.getTime());
}

/** The instant at which the given wall clock reads, in the app's zone. */
function fromAppZoneWallClock(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
): Date {
  return plain(
    new TZDate(year, month - 1, day, hours, minutes, 0, 0, APP_TIME_ZONE),
  );
}

// ── Calendar dates (Postgres `date`) ─────────────────────────────────────────

/** Parse a `<input type="date">` value into the UTC-midnight `Date` a `date` column wants. */
export function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return isValid(parsed) ? parsed : null;
}

/** Format a `date`-column value back into a `<input type="date">` value. */
export function formatCalendarDateInput(date: Date): string {
  return new Date(date.getTime()).toISOString().slice(0, 10);
}

/** Today *in the app's zone*, as the UTC-midnight `Date` used for `date` columns. */
export function todayAsCalendarDate(now: Date = new Date()): Date {
  return new Date(`${format(inAppZone(now), "yyyy-MM-dd")}T00:00:00.000Z`);
}

/** Human label for a `date`-column value, e.g. "Sep 3, 2026". */
export function formatCalendarDate(date: Date, pattern = "MMM d, yyyy"): string {
  // The value is UTC midnight standing for a calendar day, so it is read back in
  // UTC: the day that was stored is the day that is shown, in any host zone.
  return format(new TZDate(date, "UTC"), pattern);
}

// ── Instants (Postgres `timestamp`) ──────────────────────────────────────────

/**
 * Combine `<input type="date">` + `<input type="time">` into an instant.
 *
 * A student typing "09:00" means nine in the morning where they are, so the wall
 * clock is interpreted in the app's zone rather than the server's. Getting this
 * wrong would store every deadline 5h30m off on a UTC host.
 */
export function parseLocalDateTime(
  dateValue: string,
  timeValue: string,
): Date | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!date) return null;

  const time = /^(\d{2}):(\d{2})$/.exec(timeValue);
  const hours = time ? Number(time[1]) : 0;
  const minutes = time ? Number(time[2]) : 0;
  if (hours > 23 || minutes > 59) return null;

  const parsed = fromAppZoneWallClock(
    Number(date[1]),
    Number(date[2]),
    Number(date[3]),
    hours,
    minutes,
  );
  return isValid(parsed) ? parsed : null;
}

export function formatDateInput(date: Date): string {
  return format(inAppZone(date), "yyyy-MM-dd");
}

export function formatTimeInput(date: Date): string {
  return format(inAppZone(date), "HH:mm");
}

export function formatDateTime(date: Date): string {
  return format(inAppZone(date), "MMM d, yyyy 'at' h:mm a");
}

export function formatDate(date: Date, pattern = "MMM d, yyyy"): string {
  return format(inAppZone(date), pattern);
}

export function formatTime(date: Date): string {
  return format(inAppZone(date), "h:mm a");
}

// ── Day and week windows ─────────────────────────────────────────────────────

/**
 * The instants bounding the given day *in the app's zone*.
 *
 * These become `gte`/`lte` bounds in Prisma queries, so they are returned as
 * plain `Date`s carrying the right instant — IST midnight, not host midnight.
 */
export function dayRange(date: Date): { start: Date; end: Date } {
  const zoned = inAppZone(date);
  return { start: plain(startOfDay(zoned)), end: plain(endOfDay(zoned)) };
}

export function weekRange(date: Date): { start: Date; end: Date } {
  const zoned = inAppZone(date);
  return {
    start: plain(startOfWeek(zoned, { weekStartsOn: WEEK_STARTS_ON })),
    end: plain(endOfWeek(zoned, { weekStartsOn: WEEK_STARTS_ON })),
  };
}

/** The seven days of the week containing `date`, each at that day's zone midnight. */
export function weekDays(date: Date): Date[] {
  const start = startOfWeek(inAppZone(date), { weekStartsOn: WEEK_STARTS_ON });
  // addDays on a TZDate steps civil days, so it lands on midnight rather than
  // drifting an hour if the zone ever observed DST.
  return Array.from({ length: 7 }, (_, i) => plain(addDays(start, i)));
}

/** Whole calendar days between two instants, counted on the app's calendar. */
export function calendarDaysBetween(target: Date, from: Date): number {
  return differenceInCalendarDays(inAppZone(target), inAppZone(from));
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
  const days = calendarDaysBetween(target, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days <= 13) return `In ${days} days`;
  if (days < -1 && days >= -13) return `${Math.abs(days)} days ago`;
  return formatDate(
    target,
    days > 0 && isSameYear(target, now) ? "MMM d" : "MMM d, yyyy",
  );
}

function isSameYear(a: Date, b: Date): boolean {
  return inAppZone(a).getFullYear() === inAppZone(b).getFullYear();
}

/** Whole calendar days from `now` until `target`. Negative once it is past. */
export function daysUntil(target: Date, now: Date = new Date()): number {
  return calendarDaysBetween(target, now);
}

/**
 * Countdown for an exam or deadline. Switches to hours inside the last day so
 * "Today" never hides the fact that something starts in 40 minutes.
 */
export function countdownLabel(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "Completed";

  const days = calendarDaysBetween(target, now);
  if (days >= 2) return `${days} days left`;
  if (days === 1) return "Tomorrow";

  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 2) return `${hours} hours left`;
  if (hours === 1) return "1 hour left";

  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes} min left`;
}
