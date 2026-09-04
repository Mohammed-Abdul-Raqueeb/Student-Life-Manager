import type { Route } from "next";

import type { AssignmentStatus, Priority } from "@/generated/prisma/enums";

/**
 * The unified "what is coming up" view.
 *
 * Assignments, exams and tasks are separate tables because they carry different
 * fields, but a student thinks of them as one queue. This module merges them
 * into a single sorted stream instead of storing a duplicate `Deadline` row.
 */

export type DeadlineKind = "assignment" | "exam" | "task";

export type DeadlineItem = {
  id: string;
  kind: DeadlineKind;
  title: string;
  /** The instant it is due or starts. */
  at: Date;
  subject: { id: string; name: string; code: string; color: string } | null;
  priority: Priority | null;
  /** Free-text detail: exam type, room, or the task description. */
  detail: string | null;
  isDone: boolean;
  href: Route;
};

export type AssignmentForDeadline = {
  id: string;
  title: string;
  dueDate: Date;
  priority: Priority;
  status: AssignmentStatus;
  subject: { id: string; name: string; code: string; color: string };
};

export type ExamForDeadline = {
  id: string;
  name: string;
  type: string;
  examDate: Date;
  location: string | null;
  subject: { id: string; name: string; code: string; color: string };
};

export type TaskForDeadline = {
  id: string;
  title: string;
  dueDate: Date | null;
  priority: Priority;
  status: string;
  description: string | null;
};

export function assignmentToDeadline(
  assignment: AssignmentForDeadline,
): DeadlineItem {
  return {
    id: `assignment:${assignment.id}`,
    kind: "assignment",
    title: assignment.title,
    at: assignment.dueDate,
    subject: assignment.subject,
    priority: assignment.priority,
    detail: null,
    isDone: assignment.status === "COMPLETED",
    href: "/assignments",
  };
}

/**
 * An exam that has already started is over, not overdue. Marking it done keeps
 * it out of the overdue count and out of the "needs attention" queue — a student
 * cannot act on an exam they already sat.
 */
export function examToDeadline(exam: ExamForDeadline, now: Date): DeadlineItem {
  return {
    id: `exam:${exam.id}`,
    kind: "exam",
    title: exam.name,
    at: exam.examDate,
    subject: exam.subject,
    priority: null,
    detail: exam.location,
    isDone: exam.examDate.getTime() < now.getTime(),
    href: "/exams",
  };
}

export function taskToDeadline(task: TaskForDeadline): DeadlineItem | null {
  if (!task.dueDate) return null;
  return {
    id: `task:${task.id}`,
    kind: "task",
    title: task.title,
    at: task.dueDate,
    subject: null,
    priority: task.priority,
    detail: task.description,
    isDone: task.status === "COMPLETED",
    href: "/assignments?tab=tasks",
  };
}

export function buildDeadlineStream(
  input: {
    assignments: readonly AssignmentForDeadline[];
    exams: readonly ExamForDeadline[];
    tasks: readonly TaskForDeadline[];
  },
  now: Date,
): DeadlineItem[] {
  return [
    ...input.assignments.map(assignmentToDeadline),
    ...input.exams.map((exam) => examToDeadline(exam, now)),
    ...input.tasks.map(taskToDeadline).filter((item): item is DeadlineItem => item !== null),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Not yet done and already past its due date. */
export function isOverdue(item: DeadlineItem, now: Date): boolean {
  return !item.isDone && item.at.getTime() < now.getTime();
}

export function isDueWithinDays(
  item: DeadlineItem,
  now: Date,
  days: number,
): boolean {
  if (item.isDone) return false;
  const ms = item.at.getTime() - now.getTime();
  return ms >= 0 && ms <= days * 86_400_000;
}

/** Overdue items first (most overdue at the top), then everything upcoming. */
export function sortForAttention(
  items: readonly DeadlineItem[],
  now: Date,
): DeadlineItem[] {
  const overdue = items
    .filter((item) => isOverdue(item, now))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const upcoming = items
    .filter((item) => !isOverdue(item, now) && !item.isDone)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return [...overdue, ...upcoming];
}
