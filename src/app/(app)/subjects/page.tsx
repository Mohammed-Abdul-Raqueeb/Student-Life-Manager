import { BookOpen } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SubjectCard } from "@/components/subjects/subject-card";
import { SubjectFormDialog } from "@/components/subjects/subject-form";
import { overallAttendance } from "@/lib/calculations/attendance";
import { overallAverage } from "@/lib/calculations/marks";
import { getCurrentUser } from "@/lib/db/user";
import { getSubjectSummaries } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  const now = new Date();
  const [subjects, user] = await Promise.all([
    getSubjectSummaries(now),
    getCurrentUser(),
  ]);

  const usedColors = subjects.map((subject) => subject.color);
  const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
  const attendance = overallAttendance(
    subjects.map((s) => s.attendance),
    user.settings.attendanceTargetPercent,
  );
  const average = overallAverage(
    subjects.map((s) => ({
      score: s.score.score,
      credits: s.credits,
      hasAssessments: s.score.hasAssessments,
    })),
  );

  return (
    <>
      <PageHeader
        title="Subjects"
        description="Every course you are taking this term, with attendance and performance at a glance."
        actions={<SubjectFormDialog usedColors={usedColors} />}
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description="Add your first subject to start tracking assignments, exams, attendance and marks. Everything else in the app builds on this."
          action={<SubjectFormDialog usedColors={[]} />}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Subjects" value={subjects.length} />
            <StatCard label="Total credits" value={totalCredits} />
            <StatCard
              label="Overall attendance"
              value={
                attendance.hasRecords
                  ? `${Math.round(attendance.percent)}%`
                  : "—"
              }
              hint={`Target ${user.settings.attendanceTargetPercent}%`}
              tone={
                !attendance.hasRecords
                  ? "neutral"
                  : attendance.meetsTarget
                    ? "success"
                    : "critical"
              }
            />
            <StatCard
              label="Average score"
              value={average === null ? "—" : `${average.toFixed(1)}%`}
              hint={average === null ? "No marks yet" : "Weighted by credits"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                usedColors={usedColors}
                now={now}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
