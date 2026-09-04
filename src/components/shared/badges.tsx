import {
  AlertTriangle,
  Check,
  CircleDashed,
  Clock,
  Loader,
  X,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type {
  AssessmentType,
  AssignmentStatus,
  AttendanceStatus,
  ExamType,
  Priority,
  TimetableEntryType,
} from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { subjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";

/**
 * Every status pill in the app. Each one pairs its colour with a word (and
 * usually an icon), so the meaning survives greyscale, colour blindness and a
 * screen reader.
 */

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  QUIZ: "Quiz",
  MIDTERM: "Midterm",
  FINAL: "Final",
  PRACTICAL: "Practical",
  VIVA: "Viva",
  OTHER: "Other",
};

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  ASSIGNMENT: "Assignment",
  QUIZ: "Quiz",
  MIDTERM: "Midterm",
  PROJECT: "Project",
  PRACTICAL: "Practical",
  FINAL: "Final",
  OTHER: "Other",
};

export const TIMETABLE_TYPE_LABELS: Record<TimetableEntryType, string> = {
  CLASS: "Class",
  LAB: "Lab",
  STUDY: "Study",
  OTHER: "Other",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium",
        priority === "HIGH" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        priority === "MEDIUM" &&
          "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
        priority === "LOW" && "text-muted-foreground",
      )}
    >
      {priority === "HIGH" ? (
        <AlertTriangle className="size-3" aria-hidden />
      ) : null}
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function AssignmentStatusBadge({
  status,
  overdue = false,
}: {
  status: AssignmentStatus;
  overdue?: boolean;
}) {
  if (overdue && status !== "COMPLETED") {
    return (
      <Badge className="bg-destructive text-destructive-foreground gap-1">
        <AlertTriangle className="size-3" aria-hidden />
        Overdue
      </Badge>
    );
  }

  if (status === "COMPLETED") {
    return (
      <Badge className="bg-success text-success-foreground gap-1">
        <Check className="size-3" aria-hidden />
        Completed
      </Badge>
    );
  }

  if (status === "IN_PROGRESS") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader className="size-3" aria-hidden />
        In progress
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <CircleDashed className="size-3" aria-hidden />
      Pending
    </Badge>
  );
}

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return status === "PRESENT" ? (
    <Badge className="bg-success text-success-foreground gap-1">
      <Check className="size-3" aria-hidden />
      Present
    </Badge>
  ) : (
    <Badge className="bg-destructive text-destructive-foreground gap-1">
      <X className="size-3" aria-hidden />
      Absent
    </Badge>
  );
}

export function CountdownBadge({
  label,
  urgent = false,
  past = false,
}: {
  label: string;
  urgent?: boolean;
  past?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "tabular gap-1",
        past && "text-muted-foreground",
        urgent && !past && "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
      )}
    >
      <Clock className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

/** A subject chip: coloured dot plus code. Links to the subject when asked to. */
export function SubjectChip({
  subject,
  showName = false,
  href,
}: {
  subject: { id: string; name: string; code: string; color: string };
  showName?: boolean;
  href?: Route;
}) {
  const color = subjectColor(subject.color);

  const content = (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        color.soft,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", color.dot)} aria-hidden />
      <span className="truncate">{showName ? subject.name : subject.code}</span>
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="max-w-full hover:opacity-80">
      {content}
    </Link>
  );
}

/** A plain coloured dot, for dense rows where a full chip is too much. */
export function SubjectDot({ color }: { color: string }) {
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", subjectColor(color).dot)}
      aria-hidden
    />
  );
}
