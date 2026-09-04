import { describe, expect, it } from "vitest";

import {
  goalCompletionPercent,
  goalProgressPercent,
  minutesByDay,
  minutesBySubject,
  sessionMinutes,
  totalMinutes,
  weeklyTrend,
} from "./study";

const at = (iso: string) => new Date(iso);

describe("sessionMinutes", () => {
  it("measures the gap between the two instants", () => {
    expect(
      sessionMinutes({
        startedAt: at("2026-09-03T14:00:00"),
        endedAt: at("2026-09-03T15:30:00"),
      }),
    ).toBe(90);
  });

  it("handles a session that crosses midnight", () => {
    expect(
      sessionMinutes({
        startedAt: at("2026-09-03T23:30:00"),
        endedAt: at("2026-09-04T00:45:00"),
      }),
    ).toBe(75);
  });

  it("returns 0 for an empty or inverted range instead of a negative duration", () => {
    expect(
      sessionMinutes({
        startedAt: at("2026-09-03T14:00:00"),
        endedAt: at("2026-09-03T14:00:00"),
      }),
    ).toBe(0);
    expect(
      sessionMinutes({
        startedAt: at("2026-09-03T15:00:00"),
        endedAt: at("2026-09-03T14:00:00"),
      }),
    ).toBe(0);
  });
});

describe("totalMinutes", () => {
  it("sums a week of sessions", () => {
    const total = totalMinutes([
      { startedAt: at("2026-08-31T09:00:00"), endedAt: at("2026-08-31T11:00:00") },
      { startedAt: at("2026-09-01T18:00:00"), endedAt: at("2026-09-01T19:30:00") },
      { startedAt: at("2026-09-03T20:00:00"), endedAt: at("2026-09-04T04:00:00") },
    ]);
    // 120 + 90 + 480 (the third ends at 04:00 the next day)
    expect(total).toBe(690);
  });

  it("is 0 for no sessions", () => {
    expect(totalMinutes([])).toBe(0);
  });
});

describe("minutesByDay", () => {
  const monday = at("2026-08-31T00:00:00");

  it("always returns seven buckets so the axis stays stable", () => {
    const days = minutesByDay([], monday);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(days.every((d) => d.minutes === 0)).toBe(true);
  });

  it("buckets sessions onto the day they started", () => {
    const days = minutesByDay(
      [
        { startedAt: at("2026-08-31T09:00:00"), endedAt: at("2026-08-31T10:00:00") },
        { startedAt: at("2026-08-31T14:00:00"), endedAt: at("2026-08-31T15:30:00") },
        { startedAt: at("2026-09-02T20:00:00"), endedAt: at("2026-09-02T22:00:00") },
      ],
      monday,
    );
    expect(days[0].minutes).toBe(150); // Monday: 60 + 90
    expect(days[2].minutes).toBe(120); // Wednesday
    expect(days[1].minutes).toBe(0);
  });

  it("ignores sessions outside the week", () => {
    const days = minutesByDay(
      [
        { startedAt: at("2026-08-30T09:00:00"), endedAt: at("2026-08-30T10:00:00") },
        { startedAt: at("2026-09-07T09:00:00"), endedAt: at("2026-09-07T10:00:00") },
      ],
      monday,
    );
    expect(totalMinutes([])).toBe(0);
    expect(days.reduce((sum, d) => sum + d.minutes, 0)).toBe(0);
  });

  it("counts a midnight-crossing session on its start day", () => {
    const days = minutesByDay(
      [{ startedAt: at("2026-09-06T23:00:00"), endedAt: at("2026-09-07T01:00:00") }],
      monday,
    );
    expect(days[6].minutes).toBe(120); // Sunday
  });
});

describe("minutesBySubject", () => {
  const subjects = [
    { id: "s1", name: "Database Systems" },
    { id: "s2", name: "Mathematics" },
    { id: "s3", name: "Deep Learning" },
  ];

  it("totals per subject, largest first", () => {
    const totals = minutesBySubject(
      [
        {
          subjectId: "s2",
          startedAt: at("2026-09-01T09:00:00"),
          endedAt: at("2026-09-01T10:00:00"),
        },
        {
          subjectId: "s1",
          startedAt: at("2026-09-01T11:00:00"),
          endedAt: at("2026-09-01T14:00:00"),
        },
        {
          subjectId: "s2",
          startedAt: at("2026-09-02T09:00:00"),
          endedAt: at("2026-09-02T09:30:00"),
        },
      ],
      subjects,
    );
    expect(totals.map((t) => [t.subject.id, t.minutes])).toEqual([
      ["s1", 180],
      ["s2", 90],
    ]);
  });

  it("drops subjects with no logged time rather than charting zeros", () => {
    const totals = minutesBySubject([], subjects);
    expect(totals).toEqual([]);
  });
});

describe("goal progress", () => {
  it("computes the percentage of the weekly goal", () => {
    expect(goalProgressPercent(690, 900)).toBeCloseTo(76.667, 3);
    expect(goalCompletionPercent(690, 900)).toBeCloseTo(76.667, 3);
  });

  it("caps the progress bar at 100 but reports the true completion", () => {
    expect(goalProgressPercent(1200, 900)).toBe(100);
    expect(goalCompletionPercent(1200, 900)).toBeCloseTo(133.333, 3);
  });

  it("returns 0 for a zero goal instead of dividing by zero", () => {
    expect(goalProgressPercent(600, 0)).toBe(0);
    expect(goalCompletionPercent(600, 0)).toBe(0);
  });
});

describe("weeklyTrend", () => {
  it("returns one point per week, oldest first", () => {
    const trend = weeklyTrend([], at("2026-09-03T12:00:00"), 4);
    expect(trend).toHaveLength(4);
    for (let i = 1; i < trend.length; i += 1) {
      expect(trend[i].weekStart.getTime()).toBeGreaterThan(
        trend[i - 1].weekStart.getTime(),
      );
    }
  });

  it("attributes sessions to the Monday-based week they started in", () => {
    const trend = weeklyTrend(
      [
        // Current week (Mon 31 Aug – Sun 6 Sep 2026)
        { startedAt: at("2026-09-01T09:00:00"), endedAt: at("2026-09-01T11:00:00") },
        // Previous week
        { startedAt: at("2026-08-26T09:00:00"), endedAt: at("2026-08-26T10:00:00") },
      ],
      at("2026-09-03T12:00:00"),
      2,
    );
    expect(trend[0].minutes).toBe(60); // previous week
    expect(trend[1].minutes).toBe(120); // current week
  });

  it("ignores sessions older than the window", () => {
    const trend = weeklyTrend(
      [{ startedAt: at("2026-01-05T09:00:00"), endedAt: at("2026-01-05T11:00:00") }],
      at("2026-09-03T12:00:00"),
      4,
    );
    expect(trend.reduce((sum, p) => sum + p.minutes, 0)).toBe(0);
  });
});
