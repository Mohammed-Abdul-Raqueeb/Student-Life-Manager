import { Trash2 } from "lucide-react";
import Link from "next/link";

import { deleteAssessment } from "@/actions/assessments";
import { ASSESSMENT_TYPE_LABELS } from "@/components/shared/badges";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { AssessmentFormDialog } from "@/components/marks/assessment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { percentage, type GradeBand } from "@/lib/calculations/marks";
import { formatCalendarDate } from "@/lib/date";
import type { AssessmentRow, MarksOverview, SubjectRef } from "@/lib/db/queries";
import { subjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";
import { subjectPath } from "@/lib/routes";

type SubjectMarks = MarksOverview["subjects"][number];

/**
 * One subject's marks: the headline score, how it was arrived at, and the rows
 * behind it.
 *
 * When the subject uses weightage the card says so explicitly — "82.5% of the
 * 55% assessed so far" is a very different claim from "82.5% final", and hiding
 * that distinction would be the misleading kind of summary.
 */
export function SubjectMarksCard({
  entry,
  subjects,
  gradingScale,
}: {
  entry: SubjectMarks;
  subjects: readonly SubjectRef[];
  gradingScale: readonly GradeBand[];
}) {
  const color = subjectColor(entry.subject.color);
  const { score } = entry;

  return (
    <Card className={cn("gap-0 overflow-hidden border-l-4 p-0", color.border)}>
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <Link
            href={subjectPath(entry.subject.id)}
            className="hover:text-primary font-semibold"
          >
            {entry.subject.name}
          </Link>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {entry.subject.code} · {entry.subject.credits}{" "}
            {entry.subject.credits === 1 ? "credit" : "credits"}
          </p>
        </div>

        <div className="flex items-start gap-6">
          <div>
            <p className="stat-label">Current score</p>
            <p className="tabular mt-0.5 text-2xl font-semibold">
              {score.hasAssessments ? (
                `${score.score.toFixed(1)}%`
              ) : (
                <span className="text-muted-foreground text-lg">—</span>
              )}
            </p>
          </div>
          <div>
            <p className="stat-label">Grade</p>
            <p className="tabular mt-0.5 text-2xl font-semibold">
              {entry.grade ?? (
                <span className="text-muted-foreground text-lg">—</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {score.hasAssessments ? (
        <p className="text-muted-foreground border-t px-5 py-2.5 text-xs">
          {score.isWeighted ? (
            <>
              Weighted score across the {score.weightCovered}% of the final grade
              assessed so far — {score.earnedOfFinal.toFixed(1)} of those{" "}
              {score.weightCovered} points earned.
            </>
          ) : (
            <>
              Unweighted aggregate: {formatMarks(score.totalObtained)} of{" "}
              {formatMarks(score.totalMax)} marks across {score.count}{" "}
              {score.count === 1 ? "assessment" : "assessments"}.
            </>
          )}
        </p>
      ) : null}

      {entry.assessments.length > 0 ? (
        <ul className="divide-y border-t">
          {entry.assessments.map((assessment) => (
            <AssessmentRowItem
              key={assessment.id}
              assessment={assessment}
              subjects={subjects}
              gradingScale={gradingScale}
            />
          ))}
        </ul>
      ) : (
        <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
          <p className="text-muted-foreground text-sm">No marks recorded yet.</p>
          <AssessmentFormDialog
            subjects={subjects}
            defaultSubjectId={entry.subject.id}
            trigger={
              <Button size="sm" variant="outline">
                Record marks
              </Button>
            }
          />
        </div>
      )}
    </Card>
  );
}

function AssessmentRowItem({
  assessment,
  subjects,
  gradingScale,
}: {
  assessment: AssessmentRow;
  subjects: readonly SubjectRef[];
  gradingScale: readonly GradeBand[];
}) {
  const percent = percentage(assessment.marksObtained, assessment.maxMarks);
  void gradingScale;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{assessment.name}</p>
          <Badge variant="outline" className="text-muted-foreground">
            {ASSESSMENT_TYPE_LABELS[assessment.type]}
          </Badge>
          {assessment.weightage > 0 ? (
            <Badge variant="secondary" className="tabular">
              {formatMarks(assessment.weightage)}% weight
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground tabular mt-0.5 text-xs">
          {formatCalendarDate(assessment.date)}
        </p>
      </div>

      <div className="text-right">
        <p className="tabular text-sm font-semibold">
          {formatMarks(assessment.marksObtained)} /{" "}
          {formatMarks(assessment.maxMarks)}
        </p>
        <p className="text-muted-foreground tabular text-xs">
          {percent.toFixed(1)}%
        </p>
      </div>

      <div className="flex items-center gap-1">
        <AssessmentFormDialog
          subjects={subjects}
          assessment={{
            id: assessment.id,
            name: assessment.name,
            subjectId: assessment.subject.id,
            type: assessment.type,
            marksObtained: assessment.marksObtained,
            maxMarks: assessment.maxMarks,
            weightage: assessment.weightage,
            date: assessment.date,
          }}
          trigger={
            <Button size="sm" variant="ghost" className="text-muted-foreground h-8 px-2 text-xs">
              Edit
            </Button>
          }
        />
        <ConfirmAction
          trigger={
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive h-8 px-2"
              aria-label={`Delete ${assessment.name}`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          }
          title={`Delete "${assessment.name}"?`}
          description="The marks will be removed and the subject's score recalculated. This cannot be undone."
          action={deleteAssessment.bind(null, assessment.id)}
        />
      </div>
    </li>
  );
}

/** Trims a trailing ".0" so whole marks read as "40", not "40.0". */
function formatMarks(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
