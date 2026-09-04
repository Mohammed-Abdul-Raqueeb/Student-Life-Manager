import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";

import type { AttendanceStats } from "@/lib/calculations/attendance";
import { attendanceHealth } from "@/lib/calculations/attendance";
import { cn } from "@/lib/utils";

/**
 * The attendance figure, its bar, and the one sentence that tells the student
 * what to do about it.
 *
 * "73%" on its own is not actionable; "attend the next 2 classes to reach 75%"
 * is. Both numbers come from `src/lib/calculations/attendance`, which computes
 * them in integers so the advice is always literally true.
 */

const HEALTH_BAR = {
  "no-data": "bg-muted-foreground/30",
  healthy: "bg-success",
  "at-risk": "bg-warning",
  below: "bg-destructive",
} as const;

const HEALTH_TEXT = {
  "no-data": "text-muted-foreground",
  healthy: "text-success",
  "at-risk": "text-warning-foreground dark:text-warning",
  below: "text-destructive",
} as const;

export function AttendanceBar({
  stats,
  className,
}: {
  stats: AttendanceStats;
  className?: string;
}) {
  const health = attendanceHealth(stats);
  const width = stats.hasRecords ? Math.min(100, Math.max(0, stats.percent)) : 0;

  return (
    <div
      className={cn("bg-muted relative h-2 overflow-hidden rounded-full", className)}
      role="img"
      aria-label={
        stats.hasRecords
          ? `${Math.round(stats.percent)} percent attendance, target ${stats.targetPercent} percent`
          : "No attendance recorded"
      }
    >
      <div
        className={cn("h-full rounded-full transition-[width]", HEALTH_BAR[health])}
        style={{ width: `${width}%` }}
      />
      {/* The target marker, so the bar is readable without reading the numbers. */}
      <span
        className="bg-foreground/45 absolute top-0 h-full w-px"
        style={{ left: `${stats.targetPercent}%` }}
        aria-hidden
      />
    </div>
  );
}

export function AttendancePercent({
  stats,
  className,
}: {
  stats: AttendanceStats;
  className?: string;
}) {
  const health = attendanceHealth(stats);

  if (!stats.hasRecords) {
    return (
      <span className={cn("text-muted-foreground", className)}>No classes</span>
    );
  }

  return (
    <span className={cn("tabular", HEALTH_TEXT[health], className)}>
      {Math.round(stats.percent)}%
    </span>
  );
}

/** The plain-language advice line. Returns null when there is nothing to say. */
export function AttendanceAdvice({
  stats,
  className,
}: {
  stats: AttendanceStats;
  className?: string;
}) {
  const health = attendanceHealth(stats);
  const message = attendanceAdviceText(stats);
  if (!message) return null;

  const Icon =
    health === "below"
      ? AlertTriangle
      : health === "at-risk"
        ? AlertTriangle
        : health === "healthy"
          ? CheckCircle2
          : MinusCircle;

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs",
        HEALTH_TEXT[health],
        className,
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

export function attendanceAdviceText(stats: AttendanceStats): string | null {
  if (!stats.hasRecords) {
    return "No classes recorded yet.";
  }

  if (!stats.meetsTarget) {
    if (stats.classesNeeded === null) {
      return `A ${stats.targetPercent}% target cannot be reached once a class has been missed.`;
    }
    return `Below the ${stats.targetPercent}% target — attend the next ${stats.classesNeeded} ${
      stats.classesNeeded === 1 ? "class" : "classes"
    } to recover.`;
  }

  if (stats.classesCanMiss === null) {
    return "Comfortably above target.";
  }

  if (stats.classesCanMiss === 0) {
    return `Exactly on target — missing one more class drops you below ${stats.targetPercent}%.`;
  }

  return `You can miss ${stats.classesCanMiss} more ${
    stats.classesCanMiss === 1 ? "class" : "classes"
  } and stay at ${stats.targetPercent}%.`;
}
