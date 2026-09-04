"use client";

import { updateAcademicSettings, updateProfile } from "@/actions/settings";
import { TextInput } from "@/components/shared/form-controls";
import { InlineForm } from "@/components/shared/form-dialog";
import { FieldRow, FormField } from "@/components/shared/form-field";
import type { CurrentUser } from "@/lib/db/user";

export function ProfileForm({ user }: { user: CurrentUser }) {
  return (
    <InlineForm action={updateProfile} submitLabel="Save profile">
      {(errors) => (
        <>
          <FormField id="profile-name" label="Your name" required error={errors.name}>
            {(props) => (
              <TextInput
                {...props}
                name="name"
                defaultValue={user.name}
                maxLength={120}
                autoComplete="name"
                required
              />
            )}
          </FormField>

          <FormField
            id="profile-college"
            label="College or university"
            error={errors.collegeName}
          >
            {(props) => (
              <TextInput
                {...props}
                name="collegeName"
                defaultValue={user.settings.collegeName ?? ""}
                placeholder="Riverside Institute of Technology"
                maxLength={160}
              />
            )}
          </FormField>

          <FieldRow>
            <FormField
              id="profile-program"
              label="Course or programme"
              error={errors.program}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="program"
                  defaultValue={user.settings.program ?? ""}
                  placeholder="B.Tech Computer Science"
                  maxLength={160}
                />
              )}
            </FormField>

            <FormField
              id="profile-semester"
              label="Semester or year"
              error={errors.semester}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="semester"
                  defaultValue={user.settings.semester ?? ""}
                  placeholder="Semester 5"
                  maxLength={60}
                />
              )}
            </FormField>
          </FieldRow>
        </>
      )}
    </InlineForm>
  );
}

export function AcademicSettingsForm({ user }: { user: CurrentUser }) {
  const goalHours = user.settings.weeklyStudyGoalMinutes / 60;

  return (
    <InlineForm action={updateAcademicSettings} submitLabel="Save academic settings">
      {(errors) => (
        <FieldRow>
          <FormField
            id="attendance-target"
            label="Attendance target"
            hint="Percent. Most institutions require 75%."
            error={errors.attendanceTargetPercent}
            required
          >
            {(props) => (
              <TextInput
                {...props}
                name="attendanceTargetPercent"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                defaultValue={user.settings.attendanceTargetPercent}
                required
              />
            )}
          </FormField>

          <FormField
            id="study-goal"
            label="Weekly study goal"
            hint="Hours per week. Set 0 to turn the goal off."
            error={errors.weeklyStudyGoalHours}
            required
          >
            {(props) => (
              <TextInput
                {...props}
                name="weeklyStudyGoalHours"
                type="number"
                inputMode="decimal"
                min={0}
                max={168}
                step={0.5}
                defaultValue={goalHours}
                required
              />
            )}
          </FormField>
        </FieldRow>
      )}
    </InlineForm>
  );
}
