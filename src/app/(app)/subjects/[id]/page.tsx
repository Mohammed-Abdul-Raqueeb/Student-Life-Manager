import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  NotebookPen,
  Timer,
  UserCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentFormDialog } from "@/components/assignments/assignment-form";
import { AssignmentList } from "@/components/assignments/assignment-list";
import { AssessmentBreakdownChart } from "@/components/charts/marks-charts";
import { ExamCard } from "@/components/exams/exam-card";
import { ExamFormDialog } from "@/components/exams/exam-form";
import { AssessmentFormDialog } from "@/components/marks/assessment-form";
import { NoteFormDialog } from "@/components/notes/note-form";
import { NoteList } from "@/components/notes/note-list";
import { AttendanceHistory } from "@/components/attendance/attendance-history";
import {
  AttendanceAdvice,
  AttendanceBar,
  AttendancePercent,
} from "@/components/shared/attendance-meter";
import { ASSESSMENT_TYPE_LABELS, TIMETABLE_TYPE_LABELS } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StudySessionFormDialog } from "@/components/study/study-session-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { percentage } from "@/lib/calculations/marks";
import {
  formatCalendarDate,
  formatClockTime,
  formatDate,
  formatDuration,
  formatTime,
} from "@/lib/date";
import {
  getSubjectById,
  getSubjectDetail,
  getSubjectRefs,
  WEEKDAY_LABELS,
} from "@/lib/db/queries";
import { subjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/subjects/[id]">): Promise<Metadata> {
  const { id } = await params;
  const subject = await getSubjectById(id);

  // Rejecting the id here, before the page body streams, is what makes the
  // response a real 404 rather than a 200 that happens to render "not found".
  if (!subject) notFound();

  return { title: subject.name };
}

export default async function SubjectDetailPage({
  params,
}: PageProps<"/subjects/[id]">) {
  const { id } = await params;
  const now = new Date();

  const [detail, subjects] = await Promise.all([
    getSubjectDetail(id),
    getSubjectRefs(),
  ]);

  if (!detail) notFound();

  const color = subjectColor(detail.subject.color);
  const openAssignments = detail.assignments.filter(
    (a) => a.status !== "COMPLETED",
  );
  const upcomingExams = detail.exams.filter(
    (exam) => exam.examDate.getTime() >= now.getTime(),
  );

  const breakdown = [...detail.assessments]
    .reverse()
    .map((assessment) => ({
      name: assessment.name,
      percent: percentage(assessment.marksObtained, assessment.maxMarks),
      detail: `${ASSESSMENT_TYPE_LABELS[assessment.type]} · ${assessment.marksObtained}/${assessment.maxMarks}`,
    }));

  return (
    <>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2 mb-2"
      >
        <Link href="/subjects">
          <ArrowLeft className="size-3.5" aria-hidden />
          All subjects
        </Link>
      </Button>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span
              className={cn("size-3 shrink-0 rounded-full", color.dot)}
              aria-hidden
            />
            {detail.subject.name}
          </span>
        }
        description={[
          detail.subject.code,
          `${detail.subject.credits} ${detail.subject.credits === 1 ? "credit" : "credits"}`,
          detail.subject.instructor,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <AssignmentFormDialog
              subjects={subjects}
              defaultSubjectId={detail.subject.id}
            />
            <AssessmentFormDialog
              subjects={subjects}
              defaultSubjectId={detail.subject.id}
              trigger={<Button variant="outline">Record marks</Button>}
            />
          </>
        }
      />

      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Attendance"
            value={
              detail.attendance.hasRecords ? (
                <AttendancePercent stats={detail.attendance} />
              ) : (
                "—"
              )
            }
            hint={
              detail.attendance.hasRecords
                ? `${detail.attendance.attended} of ${detail.attendance.conducted} classes`
                : "No classes recorded"
            }
            icon={UserCheck}
            tone={
              !detail.attendance.hasRecords
                ? "neutral"
                : detail.attendance.meetsTarget
                  ? "success"
                  : "critical"
            }
          />
          <StatCard
            label="Current score"
            value={
              detail.score.hasAssessments
                ? `${detail.score.score.toFixed(1)}%`
                : "—"
            }
            hint={detail.grade ? `Grade ${detail.grade}` : "No marks yet"}
          />
          <StatCard
            label="Open assignments"
            value={openAssignments.length}
            icon={ClipboardList}
            tone={openAssignments.length > 0 ? "warning" : "success"}
          />
          <StatCard
            label="Study time"
            value={formatDuration(detail.studyMinutes)}
            icon={Timer}
            hint="All time"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="subject-attendance">
            <SectionHeader
              id="subject-attendance"
              title="Attendance"
              action={
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link href="/attendance">Record</Link>
                </Button>
              }
            />
            <Card className="gap-0 p-5">
              <div className="flex items-baseline justify-between">
                <p className="stat-label">
                  Target {detail.attendanceTargetPercent}%
                </p>
                <p className="text-2xl font-semibold">
                  <AttendancePercent stats={detail.attendance} />
                </p>
              </div>
              <AttendanceBar stats={detail.attendance} className="mt-2" />
              <AttendanceAdvice stats={detail.attendance} className="mt-2" />
            </Card>
          </section>

          <section aria-labelledby="subject-timetable">
            <SectionHeader id="subject-timetable" title="Weekly schedule" />
            {detail.timetable.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Not on your timetable"
                description="Add this subject to your weekly schedule so it appears on the Today page."
                action={
                  <Button asChild variant="outline">
                    <Link href="/timetable">Open timetable</Link>
                  </Button>
                }
                compact
              />
            ) : (
              <Card className="gap-0 p-0">
                <ul className="divide-y">
                  {detail.timetable.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 px-4 py-3 sm:px-5"
                    >
                      <span className="w-24 shrink-0 text-sm font-medium">
                        {WEEKDAY_LABELS[entry.weekday]}
                      </span>
                      <span className="tabular text-muted-foreground flex-1 text-sm">
                        {formatClockTime(entry.startTime)} –{" "}
                        {formatClockTime(entry.endTime)}
                      </span>
                      <Badge variant="outline" className="text-muted-foreground">
                        {TIMETABLE_TYPE_LABELS[entry.type]}
                      </Badge>
                      {entry.room ? (
                        <span className="text-muted-foreground text-xs">
                          {entry.room}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
        </div>

        <section aria-labelledby="subject-assignments">
          <SectionHeader
            id="subject-assignments"
            title="Assignments"
            description={`${openAssignments.length} open of ${detail.assignments.length} total.`}
            action={
              <AssignmentFormDialog
                subjects={subjects}
                defaultSubjectId={detail.subject.id}
              />
            }
          />
          {detail.assignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No assignments for this subject"
              description="Add coursework here and it will show up on your dashboard and in Today as the deadline approaches."
              action={
                <AssignmentFormDialog
                  subjects={subjects}
                  defaultSubjectId={detail.subject.id}
                />
              }
              compact
            />
          ) : (
            <AssignmentList
              assignments={detail.assignments}
              subjects={subjects}
              now={now}
            />
          )}
        </section>

        <section aria-labelledby="subject-exams">
          <SectionHeader
            id="subject-exams"
            title="Exams"
            description={
              upcomingExams.length > 0
                ? `${upcomingExams.length} upcoming.`
                : "Nothing upcoming."
            }
            action={
              <ExamFormDialog
                subjects={subjects}
                defaultSubjectId={detail.subject.id}
              />
            }
          />
          {detail.exams.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No exams scheduled"
              description="Add the quizzes, midterms and finals for this subject to see countdowns."
              action={
                <ExamFormDialog
                  subjects={subjects}
                  defaultSubjectId={detail.subject.id}
                />
              }
              compact
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {detail.exams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} subjects={subjects} now={now} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="subject-marks">
          <SectionHeader
            id="subject-marks"
            title="Marks"
            description={
              detail.score.hasAssessments
                ? detail.score.isWeighted
                  ? `Weighted across the ${detail.score.weightCovered}% assessed so far.`
                  : `Unweighted aggregate across ${detail.score.count} assessments.`
                : "Nothing recorded yet."
            }
            action={
              <AssessmentFormDialog
                subjects={subjects}
                defaultSubjectId={detail.subject.id}
              />
            }
          />
          <Card className="p-5">
            <AssessmentBreakdownChart
              data={breakdown}
              subjectName={detail.subject.name}
            />
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="subject-study">
            <SectionHeader
              id="subject-study"
              title="Recent study sessions"
              action={
                <StudySessionFormDialog
                  subjects={subjects}
                  defaultSubjectId={detail.subject.id}
                  trigger={
                    <Button variant="outline" size="sm">
                      Log session
                    </Button>
                  }
                />
              }
            />
            {detail.recentSessions.length === 0 ? (
              <EmptyState
                icon={Timer}
                title="No study sessions"
                description="Log the time you spend on this subject to see where your week actually goes."
                action={
                  <StudySessionFormDialog
                    subjects={subjects}
                    defaultSubjectId={detail.subject.id}
                  />
                }
                compact
              />
            ) : (
              <Card className="gap-0 p-0">
                <ul className="divide-y">
                  {detail.recentSessions.map((session) => (
                    <li
                      key={session.id}
                      className="flex items-center gap-3 px-4 py-3 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {session.topic ?? "Study session"}
                        </p>
                        <p className="text-muted-foreground tabular text-xs">
                          {formatDate(session.startedAt)} ·{" "}
                          {formatTime(session.startedAt)} –{" "}
                          {formatTime(session.endedAt)}
                        </p>
                      </div>
                      <p className="tabular shrink-0 text-sm font-semibold">
                        {formatDuration(session.minutes)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <section aria-labelledby="subject-attendance-history">
            <SectionHeader
              id="subject-attendance-history"
              title="Attendance history"
              description="The 40 most recent entries."
            />
            {detail.attendanceHistory.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="Nothing recorded"
                description="Mark yourself present or absent on the Attendance page and the history builds up here."
                action={
                  <Button asChild variant="outline">
                    <Link href="/attendance">Record attendance</Link>
                  </Button>
                }
                compact
              />
            ) : (
              <AttendanceHistory records={detail.attendanceHistory} />
            )}
          </section>
        </div>

        <section aria-labelledby="subject-notes">
          <SectionHeader
            id="subject-notes"
            title="Notes"
            description={`${detail.notes.length} ${detail.notes.length === 1 ? "note" : "notes"} for this subject.`}
            action={
              <NoteFormDialog
                subjects={subjects}
                defaultSubjectId={detail.subject.id}
              />
            }
          />
          {detail.notes.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No notes yet"
              description="Write down what you learn in this subject and it will be here when you revise."
              action={
                <NoteFormDialog
                  subjects={subjects}
                  defaultSubjectId={detail.subject.id}
                />
              }
              compact
            />
          ) : (
            <NoteList notes={detail.notes} subjects={subjects} />
          )}
        </section>

        {detail.assessments.length > 0 ? (
          <section aria-labelledby="subject-assessment-rows">
            <SectionHeader
              id="subject-assessment-rows"
              title="Assessment records"
              description="Newest first."
            />
            <Card className="gap-0 p-0">
              <ul className="divide-y">
                {detail.assessments.map((assessment) => (
                  <li
                    key={assessment.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {assessment.name}
                        </p>
                        <Badge variant="outline" className="text-muted-foreground">
                          {ASSESSMENT_TYPE_LABELS[assessment.type]}
                        </Badge>
                        {assessment.weightage > 0 ? (
                          <Badge variant="secondary" className="tabular">
                            {assessment.weightage}% weight
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground tabular text-xs">
                        {formatCalendarDate(assessment.date)}
                      </p>
                    </div>
                    <p className="tabular text-sm font-semibold">
                      {assessment.marksObtained} / {assessment.maxMarks}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </div>
    </>
  );
}
