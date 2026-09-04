import { Clock, MapPin, Trash2 } from "lucide-react";

import { deleteExam } from "@/actions/exams";
import { EXAM_TYPE_LABELS, SubjectChip } from "@/components/shared/badges";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { ExamFormDialog } from "@/components/exams/exam-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { countdownLabel, daysUntil, formatDate, formatDuration, formatTime } from "@/lib/date";
import type { ExamRow, SubjectRef } from "@/lib/db/queries";
import { subjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";
import { subjectPath } from "@/lib/routes";

/**
 * One exam.
 *
 * The countdown is the headline — a student checking this page is asking "how
 * long have I got?", not "what date is it?". The absolute date sits underneath
 * for when the answer matters precisely.
 */
export function ExamCard({
  exam,
  subjects,
  now,
}: {
  exam: ExamRow;
  subjects: readonly SubjectRef[];
  now: Date;
}) {
  const color = subjectColor(exam.subject.color);
  const days = daysUntil(exam.examDate, now);
  const past = exam.examDate.getTime() < now.getTime();
  const urgent = !past && days <= 3;

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-l-4 p-0",
        past ? "border-l-muted opacity-75" : color.border,
      )}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="leading-tight font-semibold">{exam.name}</h3>
              <Badge variant="secondary">{EXAM_TYPE_LABELS[exam.type]}</Badge>
            </div>
            <div className="mt-2">
              <SubjectChip
                subject={exam.subject}
                showName
                href={subjectPath(exam.subject.id)}
              />
            </div>
          </div>

          <div className="text-right">
            <p
              className={cn(
                "tabular text-lg font-semibold",
                past && "text-muted-foreground",
                urgent && "text-warning-foreground dark:text-warning",
              )}
            >
              {past ? "Completed" : countdownLabel(exam.examDate, now)}
            </p>
            <p className="text-muted-foreground tabular text-xs">
              {formatDate(exam.examDate)} · {formatTime(exam.examDate)}
            </p>
          </div>
        </div>

        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {exam.location ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {exam.location}
            </span>
          ) : null}
          {exam.durationMinutes ? (
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              {formatDuration(exam.durationMinutes)}
            </span>
          ) : null}
        </div>

        {exam.notes ? (
          <p className="text-muted-foreground mt-3 text-sm whitespace-pre-line">
            {exam.notes}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t px-5 py-3">
        <ExamFormDialog
          subjects={subjects}
          exam={{
            id: exam.id,
            name: exam.name,
            subjectId: exam.subject.id,
            type: exam.type,
            examDate: exam.examDate,
            durationMinutes: exam.durationMinutes,
            location: exam.location,
            notes: exam.notes,
          }}
        />
        <ConfirmAction
          trigger={
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive ml-auto"
              aria-label={`Delete ${exam.name}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          }
          title={`Delete "${exam.name}"?`}
          description="This removes the exam permanently. This cannot be undone."
          action={deleteExam.bind(null, exam.id)}
        />
      </div>
    </Card>
  );
}
