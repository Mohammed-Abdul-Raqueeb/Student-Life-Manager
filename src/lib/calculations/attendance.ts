/**
 * Attendance maths.
 *
 * Every function here works in *integers* — percentages are compared as
 * `attended * 100 >= target * conducted` rather than by dividing first — so the
 * answers never wobble on a floating-point rounding error. A student told
 * "attend 2 more classes" must actually reach the target after 2 classes.
 */

export type AttendanceCounts = {
  attended: number;
  conducted: number;
};

export type AttendanceStats = AttendanceCounts & {
  absent: number;
  /** 0 when no classes have been recorded. Check `hasRecords` before showing it. */
  percent: number;
  hasRecords: boolean;
  targetPercent: number;
  meetsTarget: boolean;
  /**
   * Consecutive future classes that must be attended to reach the target.
   * `0` when the target is already met. `null` when no finite number of classes
   * can get there (a 100% target after any absence).
   */
  classesNeeded: number | null;
  /**
   * Consecutive future classes that can be missed while staying at or above the
   * target. `0` when already at or below it. `null` when the target is 0% and
   * the answer is therefore unbounded.
   */
  classesCanMiss: number | null;
};

/** `attended / conducted * 100`, or 0 when nothing has been recorded. */
export function attendancePercent(attended: number, conducted: number): number {
  if (conducted <= 0) return 0;
  return (attended / conducted) * 100;
}

/**
 * Smallest integer `x >= 0` with `(attended + x) / (conducted + x) >= target`.
 *
 * Rearranged into integers with `t = target` as a whole percent:
 *   `(A + x) * 100 >= t * (C + x)`  →  `x * (100 - t) >= t * C - 100 * A`
 */
export function classesNeededForTarget(
  attended: number,
  conducted: number,
  targetPercent: number,
): number | null {
  const A = Math.max(0, Math.trunc(attended));
  const C = Math.max(A, Math.trunc(conducted));
  const t = clampPercent(targetPercent);

  if (meetsTarget(A, C, t)) return 0;

  const denominator = 100 - t;
  if (denominator <= 0) {
    // A 100% target: reachable only if nothing has ever been missed.
    return A === C ? 0 : null;
  }

  const numerator = t * C - 100 * A;
  if (numerator <= 0) return 0;

  // Integer ceiling of numerator / denominator.
  return Math.floor((numerator + denominator - 1) / denominator);
}

/**
 * Largest integer `x >= 0` with `attended / (conducted + x) >= target`, i.e. how
 * many upcoming classes can be skipped before the percentage drops through the
 * target.
 *
 * In integers: `100 * A >= t * (C + x)`  →  `t * x <= 100 * A - t * C`
 */
export function classesCanMiss(
  attended: number,
  conducted: number,
  targetPercent: number,
): number | null {
  const A = Math.max(0, Math.trunc(attended));
  const C = Math.max(A, Math.trunc(conducted));
  const t = clampPercent(targetPercent);

  // With no target there is nothing to fall below.
  if (t <= 0) return null;
  if (!meetsTarget(A, C, t)) return 0;

  const slack = 100 * A - t * C;
  if (slack < 0) return 0;

  return Math.floor(slack / t);
}

/** `attended * 100 >= target * conducted`, evaluated without dividing. */
export function meetsTarget(
  attended: number,
  conducted: number,
  targetPercent: number,
): boolean {
  const t = clampPercent(targetPercent);
  // Nothing recorded yet is not a failure — there is no data to fail.
  if (conducted <= 0) return true;
  return attended * 100 >= t * conducted;
}

export function attendanceStats(
  counts: AttendanceCounts,
  targetPercent: number,
): AttendanceStats {
  const attended = Math.max(0, Math.trunc(counts.attended));
  const conducted = Math.max(attended, Math.trunc(counts.conducted));
  const target = clampPercent(targetPercent);

  return {
    attended,
    conducted,
    absent: conducted - attended,
    percent: attendancePercent(attended, conducted),
    hasRecords: conducted > 0,
    targetPercent: target,
    meetsTarget: meetsTarget(attended, conducted, target),
    classesNeeded: classesNeededForTarget(attended, conducted, target),
    classesCanMiss: classesCanMiss(attended, conducted, target),
  };
}

/** Aggregate several subjects into one overall figure. */
export function overallAttendance(
  perSubject: readonly AttendanceCounts[],
  targetPercent: number,
): AttendanceStats {
  const totals = perSubject.reduce<AttendanceCounts>(
    (acc, s) => ({
      attended: acc.attended + s.attended,
      conducted: acc.conducted + s.conducted,
    }),
    { attended: 0, conducted: 0 },
  );
  return attendanceStats(totals, targetPercent);
}

/**
 * How close a subject is to its target, for colouring a badge.
 * `at-risk` is the band within 5 points above the target — technically fine, but
 * one absence away from not being.
 */
export type AttendanceHealth = "no-data" | "healthy" | "at-risk" | "below";

export function attendanceHealth(stats: AttendanceStats): AttendanceHealth {
  if (!stats.hasRecords) return "no-data";
  if (!stats.meetsTarget) return "below";
  if (stats.classesCanMiss !== null && stats.classesCanMiss < 1) return "at-risk";
  return "healthy";
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
