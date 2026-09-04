import { addDays, format, startOfDay } from "date-fns";

import { calendarDaysBetween, inAppZone, weekRange } from "@/lib/date";

/**
 * Study-session maths. Durations are derived from the two stored instants, which
 * means a session from 23:30 to 00:45 is simply 75 minutes — no special case
 * for crossing midnight.
 *
 * Durations are pure instant arithmetic and so need no timezone. Grouping is a
 * different matter: which day or week a session lands in is a calendar question,
 * and every one of those here is answered on the app's calendar rather than the
 * host's. See `src/lib/date.ts`.
 */

export type StudySessionLike = {
  startedAt: Date;
  endedAt: Date;
};

/** Whole minutes between the two instants. Zero if the range is empty or inverted. */
export function sessionMinutes(session: StudySessionLike): number {
  const ms = session.endedAt.getTime() - session.startedAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60_000);
}

export function totalMinutes(sessions: readonly StudySessionLike[]): number {
  return sessions.reduce((total, session) => total + sessionMinutes(session), 0);
}

export type DayTotal = {
  /** Midnight, on the app's calendar, of the day the session started. */
  date: Date;
  /** Short weekday label, e.g. "Mon". */
  label: string;
  minutes: number;
};

/**
 * Minutes per day across the seven days beginning at `weekStart`. Always returns
 * exactly 7 buckets so a chart keeps a stable x-axis on a quiet week.
 */
export function minutesByDay(
  sessions: readonly (StudySessionLike & { startedAt: Date })[],
  weekStart: Date,
): DayTotal[] {
  // Step civil days from the zone's midnight. Stepping with setDate/setHours
  // would snap to the *host's* midnight and shift every boundary by the offset.
  const start = startOfDay(inAppZone(weekStart));

  const buckets: DayTotal[] = Array.from({ length: 7 }, (_, offset) => {
    const day = addDays(start, offset);
    return {
      date: new Date(day.getTime()),
      label: format(day, "EEE"),
      minutes: 0,
    };
  });

  for (const session of sessions) {
    const offset = calendarDaysBetween(session.startedAt, buckets[0].date);
    if (offset < 0 || offset > 6) continue;
    buckets[offset].minutes += sessionMinutes(session);
  }

  return buckets;
}

export type SubjectTotal<T> = {
  subject: T;
  minutes: number;
};

/** Minutes per subject, largest first. Subjects with no time are dropped. */
export function minutesBySubject<T extends { id: string }>(
  sessions: readonly (StudySessionLike & { subjectId: string })[],
  subjects: readonly T[],
): SubjectTotal<T>[] {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(
      session.subjectId,
      (totals.get(session.subjectId) ?? 0) + sessionMinutes(session),
    );
  }

  return subjects
    .map((subject) => ({ subject, minutes: totals.get(subject.id) ?? 0 }))
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

/** Percent of the weekly goal completed, capped at 100 for progress bars. */
export function goalProgressPercent(
  minutes: number,
  goalMinutes: number,
): number {
  if (goalMinutes <= 0) return 0;
  return Math.min(100, (minutes / goalMinutes) * 100);
}

/** Uncapped percent, for the "you have completed 118% of your goal" copy. */
export function goalCompletionPercent(
  minutes: number,
  goalMinutes: number,
): number {
  if (goalMinutes <= 0) return 0;
  return (minutes / goalMinutes) * 100;
}

export type WeeklyTrendPoint = {
  weekStart: Date;
  label: string;
  minutes: number;
};

/**
 * Minutes per week for the `weeks` most recent weeks, oldest first — the trend
 * chart on the Study Progress page.
 */
export function weeklyTrend(
  sessions: readonly StudySessionLike[],
  now: Date,
  weeks: number,
): WeeklyTrendPoint[] {
  const currentWeekStart = inAppZone(weekRange(now).start);

  const points: WeeklyTrendPoint[] = Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(currentWeekStart, -(weeks - 1 - i) * 7);
    return {
      weekStart: new Date(weekStart.getTime()),
      label: format(weekStart, "d/M"),
      minutes: 0,
    };
  });

  for (const session of sessions) {
    // Both sides go through weekRange, so a session lands in a bucket only when
    // it falls in that week on the student's calendar, not the host's.
    const sessionWeek = weekRange(session.startedAt).start.getTime();
    const index = points.findIndex(
      (point) => point.weekStart.getTime() === sessionWeek,
    );
    if (index === -1) continue;
    points[index].minutes += sessionMinutes(session);
  }

  return points;
}
