import type { Metadata } from "next";

import { AppearanceForm } from "@/components/settings/appearance-form";
import { GradingScaleEditor } from "@/components/settings/grading-scale-editor";
import {
  AcademicSettingsForm,
  ProfileForm,
} from "@/components/settings/settings-forms";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/date";
import { getCurrentUser } from "@/lib/db/user";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, the targets the app measures you against, and how it looks."
      />

      <div className="max-w-3xl space-y-6">
        <SettingsCard
          id="profile"
          title="Profile"
          description="Shown in the sidebar and used to greet you on the dashboard."
        >
          <ProfileForm user={user} />
        </SettingsCard>

        <SettingsCard
          id="academic"
          title="Academic targets"
          description={`Attendance advice and the study meter are measured against these. Currently ${user.settings.attendanceTargetPercent}% attendance and ${formatDuration(user.settings.weeklyStudyGoalMinutes)} of study a week.`}
        >
          <AcademicSettingsForm user={user} />
        </SettingsCard>

        <SettingsCard
          id="grading"
          title="Grading scale"
          description="Grading scales differ by institution, so nothing in the app assumes one. Every grade shown on Marks & Grades comes from these bands."
        >
          <GradingScaleEditor scale={user.settings.gradingScale} />
        </SettingsCard>

        <SettingsCard
          id="appearance"
          title="Appearance"
          description="Applied immediately and remembered for your next visit."
        >
          <AppearanceForm initial={user.settings.theme} />
        </SettingsCard>

        <SettingsCard
          id="about"
          title="About your data"
          description="Where the information in this app lives."
        >
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              Everything is stored in your own PostgreSQL database. Derived
              numbers — attendance percentages, weighted scores, study durations
              — are calculated from your records on every page load rather than
              stored, so a total can never drift out of step with the history
              behind it.
            </p>
            <p>
              Deleting a subject also deletes its assignments, exams, attendance,
              notes, marks, study sessions and timetable slots. Each delete asks
              first.
            </p>
          </div>
        </SettingsCard>
      </div>
    </>
  );
}

function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    // `scroll-mt` keeps the heading clear of the sticky top bar when linked to.
    <Card id={id} className="scroll-mt-20 gap-0 p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">{description}</p>
      {children}
    </Card>
  );
}
