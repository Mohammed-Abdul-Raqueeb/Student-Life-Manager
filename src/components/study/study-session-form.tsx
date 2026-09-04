"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { createStudySession, updateStudySession } from "@/actions/study";
import { subjectOptions } from "@/components/assignments/assignment-form";
import {
  FormSelect,
  TextArea,
  TextInput,
} from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { FieldRow, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { formatDateInput, formatTimeInput } from "@/lib/date";
import type { SubjectRef } from "@/lib/db/queries";

export type StudySessionFormValues = {
  id: string;
  subjectId: string;
  topic: string | null;
  startedAt: Date;
  endedAt: Date;
  notes: string | null;
};

export function StudySessionFormDialog({
  subjects,
  session,
  defaultSubjectId,
  trigger,
}: {
  subjects: readonly SubjectRef[];
  session?: StudySessionFormValues;
  defaultSubjectId?: string;
  trigger?: ReactNode;
}) {
  const editing = session !== undefined;
  const disabled = subjects.length === 0;
  const start = session?.startedAt ?? defaultStart();
  const end = session?.endedAt ?? defaultEnd(start);

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button
            size={editing ? "sm" : "default"}
            variant={editing ? "outline" : "default"}
            disabled={disabled}
            title={disabled ? "Add a subject first" : undefined}
          >
            {editing ? (
              <>
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                Log a session
              </>
            )}
          </Button>
        )
      }
      title={editing ? "Edit study session" : "Log a study session"}
      description={
        editing
          ? "Update the times. The duration is recalculated from them."
          : "Record the time you actually studied. An end time earlier than the start is treated as running past midnight."
      }
      action={editing ? updateStudySession : createStudySession}
      submitLabel={editing ? "Save changes" : "Log session"}
    >
      {(errors) => (
        <>
          {editing ? <input type="hidden" name="id" value={session.id} /> : null}

          <FormField
            id="session-subject"
            label="Subject"
            required
            error={errors.subjectId}
          >
            {(props) => (
              <FormSelect
                {...props}
                name="subjectId"
                options={subjectOptions(subjects)}
                defaultValue={session?.subjectId ?? defaultSubjectId}
                placeholder="Choose a subject"
                required
              />
            )}
          </FormField>

          <FormField
            id="session-topic"
            label="Topic"
            hint="What you worked on."
            error={errors.topic}
          >
            {(props) => (
              <TextInput
                {...props}
                name="topic"
                defaultValue={session?.topic ?? ""}
                placeholder="Backpropagation"
                maxLength={160}
                autoComplete="off"
              />
            )}
          </FormField>

          <FormField id="session-date" label="Date" required error={errors.date}>
            {(props) => (
              <TextInput
                {...props}
                name="date"
                type="date"
                defaultValue={formatDateInput(start)}
                required
              />
            )}
          </FormField>

          <FieldRow>
            <FormField
              id="session-start"
              label="Start time"
              required
              error={errors.startTime}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="startTime"
                  type="time"
                  defaultValue={formatTimeInput(start)}
                  required
                />
              )}
            </FormField>

            <FormField
              id="session-end"
              label="End time"
              required
              error={errors.endTime}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="endTime"
                  type="time"
                  defaultValue={formatTimeInput(end)}
                  required
                />
              )}
            </FormField>
          </FieldRow>

          <FormField id="session-notes" label="Notes" error={errors.notes}>
            {(props) => (
              <TextArea
                {...props}
                name="notes"
                defaultValue={session?.notes ?? ""}
                rows={3}
                maxLength={2000}
                placeholder="What went well, what to revisit."
              />
            )}
          </FormField>
        </>
      )}
    </FormDialog>
  );
}

/** Defaults to the hour just gone — the common case is logging after the fact. */
function defaultStart(): Date {
  const date = new Date();
  date.setHours(date.getHours() - 1, 0, 0, 0);
  return date;
}

function defaultEnd(start: Date): Date {
  const date = new Date(start);
  date.setHours(date.getHours() + 1);
  return date;
}
