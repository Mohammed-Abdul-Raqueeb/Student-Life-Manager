import { describe, expect, it } from "vitest";

import {
  attendanceHealth,
  attendancePercent,
  attendanceStats,
  classesCanMiss,
  classesNeededForTarget,
  meetsTarget,
  overallAttendance,
} from "./attendance";

/**
 * The property that matters: whatever number the app tells a student, acting on
 * it must actually produce the promised percentage. `reaches` and `stillMeets`
 * re-check that rather than trusting the formula.
 */
const reaches = (a: number, c: number, x: number, t: number) =>
  (a + x) * 100 >= t * (c + x);

const stillMeets = (a: number, c: number, x: number, t: number) =>
  a * 100 >= t * (c + x);

describe("attendancePercent", () => {
  it("computes attended / conducted * 100", () => {
    expect(attendancePercent(22, 30)).toBeCloseTo(73.333, 3);
    expect(attendancePercent(15, 20)).toBe(75);
    expect(attendancePercent(30, 30)).toBe(100);
  });

  it("returns 0 rather than NaN when no classes were conducted", () => {
    expect(attendancePercent(0, 0)).toBe(0);
    expect(attendancePercent(5, 0)).toBe(0);
  });
});

describe("meetsTarget", () => {
  it("treats exactly the target as met", () => {
    expect(meetsTarget(15, 20, 75)).toBe(true); // 75.0%
  });

  it("rejects anything below the target", () => {
    expect(meetsTarget(22, 30, 75)).toBe(false); // 73.33%
    expect(meetsTarget(14, 20, 75)).toBe(false); // 70%
  });

  it("accepts anything above the target", () => {
    expect(meetsTarget(16, 20, 75)).toBe(true); // 80%
    expect(meetsTarget(91, 100, 75)).toBe(true);
  });

  it("does not fail a subject with no records yet", () => {
    expect(meetsTarget(0, 0, 75)).toBe(true);
  });

  it("compares exactly, with no floating-point drift", () => {
    // 1/3 is not representable in binary; 33% must still be met exactly.
    expect(meetsTarget(1, 3, 33)).toBe(true);
    expect(meetsTarget(1, 3, 34)).toBe(false);
  });
});

describe("classesNeededForTarget", () => {
  it("returns 0 when the target is already met", () => {
    expect(classesNeededForTarget(15, 20, 75)).toBe(0); // exactly 75%
    expect(classesNeededForTarget(18, 20, 75)).toBe(0); // 90%
  });

  it("matches the worked example: 70% with a 75% target needs 6 classes", () => {
    expect(classesNeededForTarget(21, 30, 75)).toBe(6);
    expect(reaches(21, 30, 6, 75)).toBe(true);
    expect(reaches(21, 30, 5, 75)).toBe(false);
  });

  it("matches the 22/30 example", () => {
    expect(classesNeededForTarget(22, 30, 75)).toBe(2); // 24/32 = 75%
    expect(reaches(22, 30, 2, 75)).toBe(true);
    expect(reaches(22, 30, 1, 75)).toBe(false);
  });

  it("returns the smallest sufficient x across a wide sweep", () => {
    for (let conducted = 0; conducted <= 40; conducted += 1) {
      for (let attended = 0; attended <= conducted; attended += 1) {
        for (const target of [0, 40, 60, 75, 80, 90]) {
          const x = classesNeededForTarget(attended, conducted, target);
          expect(x).not.toBeNull();
          const needed = x as number;
          expect(reaches(attended, conducted, needed, target)).toBe(true);
          if (needed > 0) {
            expect(reaches(attended, conducted, needed - 1, target)).toBe(false);
          }
        }
      }
    }
  });

  it("reports a 100% target as unreachable once a class has been missed", () => {
    expect(classesNeededForTarget(9, 10, 100)).toBeNull();
    expect(classesNeededForTarget(10, 10, 100)).toBe(0);
  });

  it("needs nothing when no classes have been conducted", () => {
    expect(classesNeededForTarget(0, 0, 75)).toBe(0);
  });
});

describe("classesCanMiss", () => {
  it("returns 0 when sitting exactly on the target", () => {
    expect(classesCanMiss(15, 20, 75)).toBe(0);
    expect(stillMeets(15, 20, 1, 75)).toBe(false);
  });

  it("returns 0 when already below the target", () => {
    expect(classesCanMiss(22, 30, 75)).toBe(0);
  });

  it("computes the slack above the target", () => {
    // 20/22 = 90.9%. 20/26 = 76.9% (ok); 20/27 = 74.1% (not ok).
    expect(classesCanMiss(20, 22, 75)).toBe(4);
    expect(stillMeets(20, 22, 4, 75)).toBe(true);
    expect(stillMeets(20, 22, 5, 75)).toBe(false);
  });

  it("returns the largest safe x across a wide sweep", () => {
    for (let conducted = 1; conducted <= 40; conducted += 1) {
      for (let attended = 0; attended <= conducted; attended += 1) {
        for (const target of [40, 60, 75, 80, 90, 100]) {
          const x = classesCanMiss(attended, conducted, target);
          expect(x).not.toBeNull();
          const canMiss = x as number;
          if (canMiss > 0) {
            expect(stillMeets(attended, conducted, canMiss, target)).toBe(true);
          }
          expect(stillMeets(attended, conducted, canMiss + 1, target)).toBe(false);
        }
      }
    }
  });

  it("is unbounded when the target is 0%", () => {
    expect(classesCanMiss(5, 10, 0)).toBeNull();
  });
});

describe("attendanceStats", () => {
  it("summarises a healthy subject", () => {
    const stats = attendanceStats({ attended: 20, conducted: 22 }, 75);
    expect(stats.percent).toBeCloseTo(90.909, 3);
    expect(stats.absent).toBe(2);
    expect(stats.meetsTarget).toBe(true);
    expect(stats.classesNeeded).toBe(0);
    expect(stats.classesCanMiss).toBe(4);
    expect(attendanceHealth(stats)).toBe("healthy");
  });

  it("summarises a subject below target", () => {
    const stats = attendanceStats({ attended: 22, conducted: 30 }, 75);
    expect(Math.round(stats.percent)).toBe(73);
    expect(stats.meetsTarget).toBe(false);
    expect(stats.classesNeeded).toBe(2);
    expect(stats.classesCanMiss).toBe(0);
    expect(attendanceHealth(stats)).toBe("below");
  });

  it("flags a subject sitting exactly on the target as at risk", () => {
    const stats = attendanceStats({ attended: 15, conducted: 20 }, 75);
    expect(stats.percent).toBe(75);
    expect(stats.meetsTarget).toBe(true);
    expect(attendanceHealth(stats)).toBe("at-risk");
  });

  it("reports no data instead of 0% for an untracked subject", () => {
    const stats = attendanceStats({ attended: 0, conducted: 0 }, 75);
    expect(stats.hasRecords).toBe(false);
    expect(attendanceHealth(stats)).toBe("no-data");
  });

  it("never reports more attended than conducted", () => {
    const stats = attendanceStats({ attended: 30, conducted: 10 }, 75);
    expect(stats.conducted).toBe(30);
    expect(stats.absent).toBe(0);
  });
});

describe("overallAttendance", () => {
  it("sums the raw counts rather than averaging the percentages", () => {
    // Averaging percentages would give 75%; the true figure is 20/30 = 66.7%.
    const stats = overallAttendance(
      [
        { attended: 10, conducted: 10 },
        { attended: 10, conducted: 20 },
      ],
      75,
    );
    expect(stats.attended).toBe(20);
    expect(stats.conducted).toBe(30);
    expect(stats.percent).toBeCloseTo(66.667, 3);
  });

  it("handles an empty subject list", () => {
    const stats = overallAttendance([], 75);
    expect(stats.hasRecords).toBe(false);
    expect(stats.percent).toBe(0);
  });
});
