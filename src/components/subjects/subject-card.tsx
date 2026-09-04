import { CalendarClock, ClipboardList, Trash2, User } from "lucide-react";
import Link from "next/link";

import { deleteSubject } from "@/actions/subjects";
import { ConfirmAction } from "@/components/shared/confirm-action";
import {
  AttendanceAdvice,
  AttendanceBar,
  AttendancePercent,
} from "@/components/shared/attendance-meter";
import { EXAM_TYPE_LABELS } from "@/components/shared/badges";
import { SubjectFormDialog } from "@/components/subjects/subject-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, relativeDayLabel } from "@/lib/date";
import type { SubjectSummary } from "@/lib/db/queries";
import { subjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";
import { subjectPath } from "@/lib/routes";

export function SubjectCard({
  subject,
  usedColors,
  now,
}: {
  subject: SubjectSummary;
  usedColors: readonly string[];
  now: Date;
}) {
  const color = subjectColor(subject.color);

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-l-4 p-0 transition-shadow hover:shadow-sm",
        color.border,
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={subjectPath(subject.id)}
              className="hover:text-primary text-base leading-tight font-semibold"
            >
              {subject.name}
            </Link>
            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-medium">{subject.code}</span>
              <span aria-hidden>·</span>
              <span>
                {subject.credits} {subject.credits === 1 ? "credit" : "credits"}
              </span>
            </p>
          </div>
        </div>

        {subject.instructor ? (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <User className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{subject.instructor}</span>
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="stat-label">Attendance</p>
            <p className="mt-1 text-xl font-semibold">
              <AttendancePercent stats={subject.attendance} />
            </p>
            <AttendanceBar stats={subject.attendance} className="mt-2" />
          </div>

          <div>
            <p className="stat-label">Current grade</p>
            <p className="tabular mt-1 text-xl font-semibold">
              {subject.grade ?? <span className="text-muted-foreground">—</span>}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              {subject.score.hasAssessments
                ? `${subject.score.score.toFixed(1)}% across ${subject.score.count} ${
                    subject.score.count === 1 ? "assessment" : "assessments"
                  }`
                : "No marks recorded"}
            </p>
          </div>
        </div>

        <AttendanceAdvice stats={subject.attendance} className="mt-3" />
      </div>

      <div className="bg-muted/40 mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-5 py-3 text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <ClipboardList className="size-3.5" aria-hidden />
          {subject.pendingAssignments === 0
            ? "No assignments pending"
            : `${subject.pendingAssignments} ${
                subject.pendingAssignments === 1 ? "assignment" : "assignments"
              } pending`}
        </span>

        {subject.nextExam ? (
          <span className="text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="size-3.5" aria-hidden />
            {EXAM_TYPE_LABELS[subject.nextExam.type]}{" "}
            {relativeDayLabel(subject.nextExam.examDate, now).toLowerCase()}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t px-5 py-3">
        <Button asChild size="sm" variant="secondary">
          <Link href={subjectPath(subject.id)}>View details</Link>
        </Button>
        <SubjectFormDialog
          subject={{
            id: subject.id,
            name: subject.name,
            code: subject.code,
            credits: subject.credits,
            instructor: subject.instructor,
            color: subject.color,
          }}
          usedColors={usedColors}
        />
        <ConfirmAction
          trigger={
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive ml-auto"
              aria-label={`Delete ${subject.name}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          }
          title={`Delete ${subject.name}?`}
          description={
            <>
              This also deletes everything attached to it — assignments, exams,
              attendance records, notes, marks, study sessions and timetable
              slots. This cannot be undone.
            </>
          }
          confirmLabel="Delete subject"
          action={deleteSubject.bind(null, subject.id)}
        />
      </div>
    </Card>
  );
}

export function SubjectMetaLine({
  credits,
  instructor,
  createdAt,
}: {
  credits: number;
  instructor: string | null;
  createdAt?: Date;
}) {
  return (
    <p className="text-muted-foreground text-sm">
      {[
        `${credits} ${credits === 1 ? "credit" : "credits"}`,
        instructor,
        createdAt ? `Added ${formatDate(createdAt)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>
  );
}
