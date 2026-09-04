import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ExamCard } from "@/components/exams/exam-card";
import { ExamFormDialog } from "@/components/exams/exam-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card } from "@/components/ui/card";
import { countdownLabel } from "@/lib/date";
import { getExams, getSubjectRefs } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Exams" };

export default async function ExamsPage() {
  const now = new Date();
  const [exams, subjects] = await Promise.all([getExams(), getSubjectRefs()]);

  // `getExams` sorts ascending; upcoming keeps that order, past reverses so the
  // most recent sits at the top.
  const upcoming = exams.filter((exam) => exam.examDate.getTime() >= now.getTime());
  const past = exams
    .filter((exam) => exam.examDate.getTime() < now.getTime())
    .reverse();

  const withinWeek = upcoming.filter(
    (exam) => exam.examDate.getTime() - now.getTime() <= 7 * 86_400_000,
  ).length;

  return (
    <>
      <PageHeader
        title="Exams"
        description="Every assessment with a date, counted down from today."
        actions={<ExamFormDialog subjects={subjects} />}
      />

      {exams.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No exams scheduled"
          description="Add your quizzes, midterms and finals to see live countdowns here and on your dashboard."
          action={
            subjects.length > 0 ? (
              <ExamFormDialog subjects={subjects} />
            ) : (
              <Card className="p-4 text-sm">
                Exams belong to a subject.{" "}
                <Link
                  href="/subjects"
                  className="text-primary font-medium underline"
                >
                  Add a subject first
                </Link>
                .
              </Card>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Upcoming"
              value={upcoming.length}
              icon={CalendarClock}
              tone={withinWeek > 0 ? "warning" : "neutral"}
            />
            <StatCard
              label="Within 7 days"
              value={withinWeek}
              tone={withinWeek > 0 ? "warning" : "neutral"}
            />
            <StatCard
              label="Next exam"
              value={
                upcoming[0] ? countdownLabel(upcoming[0].examDate, now) : "—"
              }
              hint={upcoming[0]?.subject.name}
            />
            <StatCard label="Completed" value={past.length} />
          </div>

          {upcoming.length > 0 ? (
            <section aria-labelledby="upcoming-exams">
              <SectionHeader
                id="upcoming-exams"
                title="Upcoming"
                description="Soonest first."
              />
              <div className="grid gap-4 lg:grid-cols-2">
                {upcoming.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    subjects={subjects}
                    now={now}
                  />
                ))}
              </div>
            </section>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No upcoming exams"
              description="Every scheduled exam is behind you. Add the next one when the date is announced."
              action={<ExamFormDialog subjects={subjects} />}
              compact
            />
          )}

          {past.length > 0 ? (
            <section aria-labelledby="past-exams">
              <SectionHeader
                id="past-exams"
                title="Completed"
                description="Most recent first. Record the marks in Marks & Grades."
              />
              <div className="grid gap-4 lg:grid-cols-2">
                {past.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    subjects={subjects}
                    now={now}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
