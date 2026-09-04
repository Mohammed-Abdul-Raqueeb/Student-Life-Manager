import { History, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { AttendanceRecorder } from "@/components/attendance/attendance-recorder";
import {
  AttendanceAdvice,
  AttendanceBar,
} from "@/components/shared/attendance-meter";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SubjectFormDialog } from "@/components/subjects/subject-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { attendanceHealth } from "@/lib/calculations/attendance";
import { formatDateInput } from "@/lib/date";
import { getAttendanceOverview } from "@/lib/db/queries";
import { subjectPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const now = new Date();
  const overview = await getAttendanceOverview(now);

  const belowTarget = overview.subjects.filter(
    (entry) => entry.stats.hasRecords && !entry.stats.meetsTarget,
  );
  const atRisk = overview.subjects.filter(
    (entry) => attendanceHealth(entry.stats) === "at-risk",
  );

  if (overview.subjects.length === 0) {
    return (
      <>
        <PageHeader
          title="Attendance"
          description="Record each class and see exactly where you stand against your target."
        />
        <EmptyState
          icon={UserCheck}
          title="No subjects to track"
          description="Attendance is recorded per subject. Add your courses and the Present / Absent buttons appear here."
          action={<SubjectFormDialog usedColors={[]} />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`Your target is ${overview.targetPercent}%. Change it in Settings.`}
        actions={
          <Button asChild variant="outline">
            <Link href="/settings#academic">Change target</Link>
          </Button>
        }
      />

      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Overall"
            value={
              overview.overall.hasRecords
                ? `${Math.round(overview.overall.percent)}%`
                : "—"
            }
            hint={
              overview.overall.hasRecords
                ? `${overview.overall.attended} of ${overview.overall.conducted} classes`
                : "Nothing recorded yet"
            }
            icon={UserCheck}
            tone={
              !overview.overall.hasRecords
                ? "neutral"
                : overview.overall.meetsTarget
                  ? "success"
                  : "critical"
            }
          />
          <StatCard
            label="Below target"
            value={belowTarget.length}
            hint={
              belowTarget.length === 0
                ? "Every subject is on track"
                : belowTarget.map((entry) => entry.subject.code).join(", ")
            }
            tone={belowTarget.length > 0 ? "critical" : "success"}
          />
          <StatCard
            label="On the edge"
            value={atRisk.length}
            hint="One absence from dropping below"
            tone={atRisk.length > 0 ? "warning" : "neutral"}
          />
          <StatCard
            label="Classes recorded"
            value={overview.overall.conducted}
            hint={`${overview.overall.absent} missed`}
          />
        </div>

        <section aria-labelledby="record-heading">
          <SectionHeader
            id="record-heading"
            title="Record attendance"
            description="Two taps per class. Everything on this page recalculates immediately."
          />
          <AttendanceRecorder
            subjects={overview.subjects}
            todayValue={formatDateInput(now)}
          />
        </section>

        <section aria-labelledby="breakdown-heading">
          <SectionHeader
            id="breakdown-heading"
            title="Where you stand"
            description="The vertical line on each bar marks your target."
          />
          <Card className="gap-0 divide-y p-0">
            {overview.subjects.map(({ subject, stats }) => (
              <div key={subject.id} className="px-4 py-4 sm:px-5">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={subjectPath(subject.id)}
                    className="hover:text-primary min-w-0 truncate text-sm font-medium"
                  >
                    {subject.name}
                  </Link>
                  <span className="tabular text-muted-foreground shrink-0 text-xs">
                    {stats.hasRecords
                      ? `${stats.attended}/${stats.conducted} · ${Math.round(stats.percent)}%`
                      : "No classes"}
                  </span>
                </div>
                <AttendanceBar stats={stats} className="mt-2" />
                <AttendanceAdvice stats={stats} className="mt-2" />
              </div>
            ))}
          </Card>
        </section>

        <section aria-labelledby="history-heading">
          <SectionHeader
            id="history-heading"
            title="History"
            description="The 60 most recent entries, newest first."
          />
          {overview.history.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nothing recorded yet"
              description="Use the Present and Absent buttons above to start building your attendance history."
              compact
            />
          ) : (
            <AttendanceHistory records={overview.history} />
          )}
        </section>
      </div>
    </>
  );
}
