import type { Route } from "next";

import { formatDuration, relativeDayLabel } from "@/lib/date";

import type { AttendanceStats } from "./attendance";
import type { DeadlineItem } from "./deadlines";
import { isDueWithinDays, isOverdue } from "./deadlines";
import { goalCompletionPercent } from "./study";

/**
 * Dashboard insights.
 *
 * Every line the dashboard shows is a deterministic consequence of rows in the
 * database — no heuristics, no generated prose. If an insight appears, the
 * student can click through and see the exact records behind it.
 */

export type InsightTone = "critical" | "warning" | "success" | "neutral";

export type Insight = {
  id: string;
  tone: InsightTone;
  message: string;
  href: Route;
};

export type InsightInput = {
  now: Date;
  deadlines: readonly DeadlineItem[];
  attendance: readonly {
    subject: { id: string; name: string };
    stats: AttendanceStats;
  }[];
  attendanceTargetPercent: number;
  studyMinutesThisWeek: number;
  weeklyStudyGoalMinutes: number;
};

export function buildInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];

  // ── Overdue work ───────────────────────────────────────────────────────────
  const overdue = input.deadlines.filter((item) => isOverdue(item, input.now));
  if (overdue.length > 0) {
    insights.push({
      id: "overdue",
      tone: "critical",
      message:
        overdue.length === 1
          ? `"${overdue[0].title}" is overdue.`
          : `${overdue.length} items are overdue.`,
      href: overdue.length === 1 ? overdue[0].href : "/assignments",
    });
  }

  // ── Attendance below target ────────────────────────────────────────────────
  const below = input.attendance
    .filter((entry) => entry.stats.hasRecords && !entry.stats.meetsTarget)
    .sort((a, b) => a.stats.percent - b.stats.percent);

  for (const entry of below.slice(0, 2)) {
    const needed = entry.stats.classesNeeded;
    const fix =
      needed === null
        ? ""
        : needed > 0
          ? ` Attend the next ${needed} ${needed === 1 ? "class" : "classes"} to recover.`
          : "";
    insights.push({
      id: `attendance:${entry.subject.id}`,
      tone: "warning",
      message: `${entry.subject.name} attendance is ${formatPercent(entry.stats.percent)}, below the ${input.attendanceTargetPercent}% target.${fix}`,
      href: `/attendance`,
    });
  }

  // ── Imminent deadlines ────────────────────────────────────────────────────
  const dueSoon = input.deadlines
    .filter(
      (item) =>
        item.kind !== "exam" && isDueWithinDays(item, input.now, 2),
    )
    .slice(0, 2);

  for (const item of dueSoon) {
    insights.push({
      id: `due:${item.id}`,
      tone: "warning",
      message: `"${item.title}" is due ${relativeDayLabel(item.at, input.now).toLowerCase()}.`,
      href: item.href,
    });
  }

  // ── Exam countdown ────────────────────────────────────────────────────────
  const nextExam = input.deadlines
    .filter((item) => item.kind === "exam" && item.at.getTime() >= input.now.getTime())
    .at(0);

  if (nextExam) {
    const days = Math.ceil(
      (nextExam.at.getTime() - input.now.getTime()) / 86_400_000,
    );
    insights.push({
      id: `exam:${nextExam.id}`,
      tone: days <= 3 ? "warning" : "neutral",
      message:
        days <= 1
          ? `${nextExam.subject?.name ?? nextExam.title} exam is ${relativeDayLabel(nextExam.at, input.now).toLowerCase()}.`
          : `${nextExam.subject?.name ?? nextExam.title} exam in ${days} days.`,
      href: "/exams",
    });
  }

  // ── Study goal ────────────────────────────────────────────────────────────
  if (input.weeklyStudyGoalMinutes > 0) {
    const completion = goalCompletionPercent(
      input.studyMinutesThisWeek,
      input.weeklyStudyGoalMinutes,
    );
    insights.push({
      id: "study-goal",
      tone: completion >= 100 ? "success" : "neutral",
      message:
        completion >= 100
          ? `Weekly study goal met — ${formatDuration(input.studyMinutesThisWeek)} logged.`
          : `You have completed ${Math.round(completion)}% of your weekly study goal.`,
      href: "/study",
    });
  }

  return insights;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
