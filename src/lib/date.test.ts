import { describe, expect, it } from "vitest";

import {
  buildDeadlineStream,
  isOverdue,
  type DeadlineItem,
} from "@/lib/calculations/deadlines";
import { minutesByDay, weeklyTrend } from "@/lib/calculations/study";
import {
  APP_TIME_ZONE,
  countdownLabel,
  dayRange,
  daysUntil,
  formatCalendarDate,
  formatCalendarDateInput,
  formatDate,
  formatDateInput,
  formatDateTime,
  formatTimeInput,
  inAppZone,
  parseCalendarDate,
  parseLocalDateTime,
  relativeDayLabel,
  todayAsCalendarDate,
  weekRange,
} from "@/lib/date";
import { weekdayFor } from "@/lib/weekdays";

/**
 * Timezone correctness.
 *
 * These tests exist because the app is deployed to Vercel, which reserves the
 * `TZ` environment variable and will not let it be set. The host therefore runs
 * on UTC while the student reads the screen in India, and every calendar-day
 * decision has to bridge that gap in application code.
 *
 * The whole suite runs under `TZ=UTC` (see `vitest.config.mts`), which is the
 * production host's clock. If the zone handling ever regresses to reading the
 * host, these fail immediately rather than five and a half hours a day in
 * production.
 */

/**
 * The boundary that matters: 20:00 UTC is already 01:30 *the next morning* in
 * India. For the 5h30m between 18:30 UTC and midnight UTC, the host and the
 * student disagree about what day it is — every day of the year.
 */
const BOUNDARY = new Date("2026-09-03T20:00:00.000Z");

describe("the UTC/IST day boundary", () => {
  it("puts the host and the student on different calendar days", () => {
    // Not an assertion about our code — a statement of the problem it solves.
    expect(BOUNDARY.toISOString()).toBe("2026-09-03T20:00:00.000Z");
    expect(BOUNDARY.getUTCDate()).toBe(3);
    expect(formatDateTime(BOUNDARY)).toBe("Sep 4, 2026 at 1:30 AM");
  });

  it("reads the instant as September 4 in the app's zone", () => {
    expect(APP_TIME_ZONE).toBe("Asia/Kolkata");
    expect(formatDateInput(BOUNDARY)).toBe("2026-09-04");
    expect(formatTimeInput(BOUNDARY)).toBe("01:30");
    expect(formatDate(BOUNDARY)).toBe("Sep 4, 2026");
  });

  it("offsets the zone by exactly +05:30", () => {
    const zoned = inAppZone(BOUNDARY);
    expect(zoned.getTime()).toBe(BOUNDARY.getTime());
    expect(zoned.getFullYear()).toBe(2026);
    expect(zoned.getMonth()).toBe(8); // September
    expect(zoned.getDate()).toBe(4);
    expect(zoned.getHours()).toBe(1);
    expect(zoned.getMinutes()).toBe(30);
  });

  it("dates the attendance record September 4, not September 3", () => {
    // A `date` column value: UTC midnight standing for a calendar day. Tapping
    // "Present" at 01:30 IST must mark today, not yesterday.
    expect(todayAsCalendarDate(BOUNDARY).toISOString()).toBe(
      "2026-09-04T00:00:00.000Z",
    );
  });

  it("opens the day window at IST midnight", () => {
    const { start, end } = dayRange(BOUNDARY);
    // 2026-09-04 00:00 IST === 2026-09-03 18:30 UTC
    expect(start.toISOString()).toBe("2026-09-03T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-09-04T18:29:59.999Z");
    expect(start.getTime()).toBeLessThan(BOUNDARY.getTime());
  });

  it("opens the week window at IST midnight on Monday", () => {
    // Sep 4 2026 is a Friday, so the week began Monday Aug 31.
    const { start } = weekRange(BOUNDARY);
    expect(start.toISOString()).toBe("2026-08-30T18:30:00.000Z");
    expect(formatDate(start)).toBe("Aug 31, 2026");
  });
});

describe("calendar-date columns", () => {
  // Attendance and assessment dates are Postgres `date` columns: a bare calendar
  // day with no time and no zone. They must render as the day that was stored,
  // on any host — never shifted by the reader's offset.
  it("shows the day that was stored, unshifted", () => {
    const stored = parseCalendarDate("2026-09-04")!;
    expect(stored.toISOString()).toBe("2026-09-04T00:00:00.000Z");
    expect(formatCalendarDate(stored)).toBe("Sep 4, 2026");
    expect(formatCalendarDateInput(stored)).toBe("2026-09-04");
  });

  it("round-trips every day of a month without drifting", () => {
    for (let day = 1; day <= 30; day += 1) {
      const iso = `2026-09-${String(day).padStart(2, "0")}`;
      expect(formatCalendarDateInput(parseCalendarDate(iso)!)).toBe(iso);
    }
  });

  it("rejects a malformed value", () => {
    expect(parseCalendarDate("2026-9-4")).toBeNull();
    expect(parseCalendarDate("")).toBeNull();
  });
});

describe("today and tomorrow", () => {
  it("calls the current IST day 'Today'", () => {
    const laterThatIstDay = new Date("2026-09-04T10:00:00.000Z"); // 15:30 IST
    expect(relativeDayLabel(laterThatIstDay, BOUNDARY)).toBe("Today");
    expect(daysUntil(laterThatIstDay, BOUNDARY)).toBe(0);
  });

  it("calls the next IST day 'Tomorrow'", () => {
    const nextIstDay = new Date("2026-09-05T04:00:00.000Z"); // Sep 5, 09:30 IST
    expect(relativeDayLabel(nextIstDay, BOUNDARY)).toBe("Tomorrow");
    expect(daysUntil(nextIstDay, BOUNDARY)).toBe(1);
  });

  it("does not call the same IST day 'Tomorrow' just because UTC rolled over", () => {
    // 2026-09-04T02:00Z is 07:30 IST on Sep 4 — the same IST day as BOUNDARY,
    // but a different UTC day. Reading the host clock would say "Tomorrow".
    const sameIstDayNextUtcDay = new Date("2026-09-04T02:00:00.000Z");
    expect(sameIstDayNextUtcDay.getUTCDate()).not.toBe(BOUNDARY.getUTCDate());
    expect(relativeDayLabel(sameIstDayNextUtcDay, BOUNDARY)).toBe("Today");
  });

  it("labels the previous IST day 'Yesterday'", () => {
    const previous = new Date("2026-09-03T06:00:00.000Z"); // Sep 3, 11:30 IST
    expect(relativeDayLabel(previous, BOUNDARY)).toBe("Yesterday");
  });
});

describe("overdue detection", () => {
  function assignment(dueDate: Date, isDone = false): DeadlineItem {
    const [item] = buildDeadlineStream(
      {
        assignments: [
          {
            id: "a1",
            title: "Database normalization",
            dueDate,
            status: isDone ? "COMPLETED" : "PENDING",
            priority: "HIGH",
            subject: {
              id: "s1",
              name: "Database Systems",
              code: "CS301",
              color: "blue",
            },
          },
        ],
        exams: [],
        tasks: [],
      },
      BOUNDARY,
    );
    return item;
  }

  it("treats an assignment due earlier the same IST day as overdue", () => {
    // Due 23:00 IST on Sep 3; it is now 01:30 IST on Sep 4.
    const due = new Date("2026-09-03T17:30:00.000Z");
    expect(isOverdue(assignment(due), BOUNDARY)).toBe(true);
  });

  it("does not treat an assignment due later today as overdue", () => {
    // Due 23:59 IST on Sep 4 — still 22.5 hours away.
    const due = parseLocalDateTime("2026-09-04", "23:59");
    expect(due).not.toBeNull();
    expect(isOverdue(assignment(due!), BOUNDARY)).toBe(false);
    expect(relativeDayLabel(due!, BOUNDARY)).toBe("Today");
  });

  it("never marks a completed assignment overdue", () => {
    const due = new Date("2026-09-01T00:00:00.000Z");
    expect(isOverdue(assignment(due, true), BOUNDARY)).toBe(false);
  });

  it("stores a typed-in deadline at the IST wall clock, not the host's", () => {
    // The student types "23:59" meaning 23:59 in India, which is 18:29 UTC.
    const due = parseLocalDateTime("2026-09-04", "23:59");
    expect(due!.toISOString()).toBe("2026-09-04T18:29:00.000Z");
    // Round-trips back to what was typed.
    expect(formatDateInput(due!)).toBe("2026-09-04");
    expect(formatTimeInput(due!)).toBe("23:59");
  });

  it("rejects malformed input rather than guessing", () => {
    expect(parseLocalDateTime("not-a-date", "09:00")).toBeNull();
    expect(parseLocalDateTime("2026-09-04", "99:99")).toBeNull();
    // A missing time is the one tolerated case: it means midnight.
    expect(parseLocalDateTime("2026-09-04", "")!.toISOString()).toBe(
      "2026-09-03T18:30:00.000Z",
    );
  });
});

describe("exam countdowns", () => {
  it("counts calendar days on the student's calendar", () => {
    // Sep 8, 09:00 IST. From Sep 4 that is 4 sleeps, not 5.
    const exam = parseLocalDateTime("2026-09-08", "09:00")!;
    expect(daysUntil(exam, BOUNDARY)).toBe(4);
    expect(countdownLabel(exam, BOUNDARY)).toBe("4 days left");
  });

  it("says Tomorrow for the next IST day", () => {
    const exam = parseLocalDateTime("2026-09-05", "09:00")!;
    expect(countdownLabel(exam, BOUNDARY)).toBe("Tomorrow");
  });

  it("switches to hours inside the last day", () => {
    const exam = parseLocalDateTime("2026-09-04", "09:00")!; // 7.5h away
    expect(countdownLabel(exam, BOUNDARY)).toBe("7 hours left");
  });

  it("reports a past exam as completed", () => {
    const exam = parseLocalDateTime("2026-09-01", "09:00")!;
    expect(countdownLabel(exam, BOUNDARY)).toBe("Completed");
    expect(daysUntil(exam, BOUNDARY)).toBe(-3);
  });

  it("does not lose a day to the host clock", () => {
    // Under UTC this instant is Sep 3, making the gap look a day wider.
    const exam = parseLocalDateTime("2026-09-06", "09:00")!;
    expect(countdownLabel(exam, BOUNDARY)).toBe("2 days left");
  });
});

describe("timetable current-day detection", () => {
  it("highlights Friday at 01:30 IST, not Thursday", () => {
    expect(weekdayFor(BOUNDARY)).toBe("FRIDAY");
  });

  it("rolls over at IST midnight rather than UTC midnight", () => {
    // 18:29:59 UTC is still Thursday 23:59 IST.
    expect(weekdayFor(new Date("2026-09-03T18:29:59.000Z"))).toBe("THURSDAY");
    // One second later it is Friday in India, while the host still says Thursday.
    expect(weekdayFor(new Date("2026-09-03T18:30:00.000Z"))).toBe("FRIDAY");
  });

  it("agrees with the formatted weekday all the way round the week", () => {
    for (let hour = 0; hour < 24 * 7; hour += 1) {
      const instant = new Date(BOUNDARY.getTime() + hour * 3_600_000);
      const expected = formatDate(instant, "EEEE").toUpperCase();
      expect(weekdayFor(instant)).toBe(expected);
    }
  });
});

describe("study grouping", () => {
  const session = (startedAt: string, minutes: number) => ({
    startedAt: new Date(startedAt),
    endedAt: new Date(new Date(startedAt).getTime() + minutes * 60_000),
  });

  it("files a late-night session under the IST day it started", () => {
    const weekStart = weekRange(BOUNDARY).start; // Mon Aug 31 IST
    const buckets = minutesByDay([session("2026-09-03T20:00:00.000Z", 90)], weekStart);

    expect(buckets).toHaveLength(7);
    expect(buckets.map((b) => b.label)).toEqual([
      "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    ]);
    // 01:30 IST on Friday Sep 4 — index 4, not Thursday's 3.
    expect(buckets[4].minutes).toBe(90);
    expect(buckets[3].minutes).toBe(0);
  });

  it("starts each bucket at IST midnight", () => {
    const buckets = minutesByDay([], weekRange(BOUNDARY).start);
    expect(buckets[0].date.toISOString()).toBe("2026-08-30T18:30:00.000Z");
    expect(buckets[6].date.toISOString()).toBe("2026-09-05T18:30:00.000Z");
  });

  it("counts a session into the IST week it belongs to", () => {
    // 18:35 UTC Sunday is already Monday 00:05 IST — the *next* week.
    const sundayLateUtc = session("2026-08-30T18:35:00.000Z", 60);
    const points = weeklyTrend([sundayLateUtc], BOUNDARY, 2);
    expect(points).toHaveLength(2);
    expect(points[1].minutes).toBe(60); // current week
    expect(points[0].minutes).toBe(0);
  });
});
