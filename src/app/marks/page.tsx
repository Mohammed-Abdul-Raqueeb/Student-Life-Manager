import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SubjectScoreChart } from "@/components/charts/marks-charts";
import { AssessmentFormDialog } from "@/components/marks/assessment-form";
import { SubjectMarksCard } from "@/components/marks/subject-marks-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SubjectFormDialog } from "@/components/subjects/subject-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMarksOverview, getSubjectRefs } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Marks & Grades" };

export default async function MarksPage() {
  const [overview, subjects] = await Promise.all([
    getMarksOverview(),
    getSubjectRefs(),
  ]);

  const graded = overview.subjects.filter((s) => s.score.hasAssessments);
  const chartData = graded.map((entry) => ({
    code: entry.subject.code,
    name: entry.subject.name,
    score: entry.score.score,
    grade: entry.grade,
  }));

  const best = [...graded].sort((a, b) => b.score.score - a.score.score)[0];

  if (subjects.length === 0) {
    return (
      <>
        <PageHeader
          title="Marks & grades"
          description="Record assessments and see how each subject is going."
        />
        <EmptyState
          icon={GraduationCap}
          title="No subjects to grade"
          description="Marks belong to a subject. Add your courses first and you can start recording assessments here."
          action={<SubjectFormDialog usedColors={[]} />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Marks & grades"
        description="Every assessment, with weighted scores where you use weightage."
        actions={
          <>
            <AssessmentFormDialog subjects={subjects} />
            <Button asChild variant="outline">
              <Link href="/settings#grading">Grading scale</Link>
            </Button>
          </>
        }
      />

      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Overall average"
            value={
              overview.overallAverage === null
                ? "—"
                : `${overview.overallAverage.toFixed(1)}%`
            }
            hint="Weighted by credits"
            icon={GraduationCap}
          />
          <StatCard
            label="Overall grade"
            value={overview.overallGrade ?? "—"}
            hint={`${overview.gradingScale.length}-band scale`}
          />
          <StatCard
            label="Assessments"
            value={overview.assessments.length}
            hint={`${graded.length} of ${overview.subjects.length} subjects graded`}
          />
          <StatCard
            label="Strongest subject"
            value={best ? best.subject.code : "—"}
            hint={best ? `${best.score.score.toFixed(1)}%` : "No marks yet"}
            tone={best ? "success" : "neutral"}
          />
        </div>

        {overview.assessments.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No marks recorded yet"
            description="Add your first assessment — a quiz, an assignment, a midterm — and this page starts tracking your performance per subject."
            action={<AssessmentFormDialog subjects={subjects} />}
          />
        ) : (
          <>
            <Card className="p-5">
              <SubjectScoreChart
                data={chartData}
                average={overview.overallAverage}
              />
            </Card>

            <section aria-labelledby="by-subject">
              <SectionHeader
                id="by-subject"
                title="By subject"
                description="Newest assessment first within each subject."
                action={<AssessmentFormDialog subjects={subjects} />}
              />
              <div className="space-y-4">
                {overview.subjects.map((entry) => (
                  <SubjectMarksCard
                    key={entry.subject.id}
                    entry={entry}
                    subjects={subjects}
                    gradingScale={overview.gradingScale}
                  />
                ))}
              </div>
            </section>

            <section aria-labelledby="scale">
              <SectionHeader
                id="scale"
                title="Your grading scale"
                description="Grades on this page come from these bands. Edit them in Settings."
              />
              <Card className="p-5">
                <div className="scroll-x">
                  <ul className="flex min-w-max gap-2">
                    {overview.gradingScale.map((band) => (
                      <li
                        key={band.grade}
                        className="bg-muted/60 rounded-lg px-3 py-2 text-center"
                      >
                        <p className="text-sm font-semibold">{band.grade}</p>
                        <p className="text-muted-foreground tabular text-xs">
                          {band.minPercent}%+
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </section>
          </>
        )}
      </div>
    </>
  );
}
