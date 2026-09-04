"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { createTimetableEntry, updateTimetableEntry } from "@/actions/timetable";
import { subjectOptions } from "@/components/assignments/assignment-form";
import { TIMETABLE_TYPE_LABELS } from "@/components/shared/badges";
import {
  FormSelect,
  optionsFromLabels,
  TextInput,
} from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { FieldRow, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import type { TimetableEntryType, Weekday } from "@/generated/prisma/enums";
import type { SubjectRef } from "@/lib/db/queries";
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/lib/weekdays";

export type TimetableFormValues = {
  id: string;
  subjectId: string | null;
  title: string | null;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string | null;
  instructor: string | null;
  type: TimetableEntryType;
};

const WEEKDAY_OPTIONS = WEEKDAY_ORDER.map((day) => ({
  value: day,
  label: WEEKDAY_LABELS[day],
}));

export function TimetableFormDialog({
  subjects,
  entry,
  defaultWeekday,
  trigger,
}: {
  subjects: readonly SubjectRef[];
  entry?: TimetableFormValues;
  defaultWeekday?: Weekday;
  trigger?: ReactNode;
}) {
  const editing = entry !== undefined;

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button size={editing ? "sm" : "default"} variant={editing ? "outline" : "default"}>
            {editing ? (
              <>
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                Add entry
              </>
            )}
          </Button>
        )
      }
      title={editing ? "Edit timetable entry" : "Add a timetable entry"}
      description={
        editing
          ? "Update this weekly slot."
          : "A recurring weekly slot. Pick a subject for a class or lab, or give it a title for anything else."
      }
      action={editing ? updateTimetableEntry : createTimetableEntry}
      submitLabel={editing ? "Save changes" : "Add entry"}
    >
      {(errors) => (
        <>
          {editing ? <input type="hidden" name="id" value={entry.id} /> : null}

          <FormField
            id="entry-subject"
            label="Subject"
            hint="Leave unset for a slot that is not a class — then give it a title."
            error={errors.subjectId}
          >
            {(props) => (
              <FormSelect
                {...props}
                name="subjectId"
                options={[
                  { value: "none", label: "No subject" },
                  ...subjectOptions(subjects),
                ]}
                defaultValue={entry?.subjectId ?? (subjects.length ? undefined : "none")}
                placeholder="Choose a subject"
              />
            )}
          </FormField>

          <FormField
            id="entry-title"
            label="Title"
            hint="Used when no subject is selected."
            error={errors.title}
          >
            {(props) => (
              <TextInput
                {...props}
                name="title"
                defaultValue={entry?.title ?? ""}
                placeholder="Self study"
                maxLength={120}
                autoComplete="off"
              />
            )}
          </FormField>

          <FieldRow>
            <FormField id="entry-weekday" label="Day" required error={errors.weekday}>
              {(props) => (
                <FormSelect
                  {...props}
                  name="weekday"
                  options={WEEKDAY_OPTIONS}
                  defaultValue={entry?.weekday ?? defaultWeekday ?? "MONDAY"}
                  required
                />
              )}
            </FormField>

            <FormField id="entry-type" label="Type" error={errors.type}>
              {(props) => (
                <FormSelect
                  {...props}
                  name="type"
                  options={optionsFromLabels(TIMETABLE_TYPE_LABELS)}
                  defaultValue={entry?.type ?? "CLASS"}
                />
              )}
            </FormField>
          </FieldRow>

          <FieldRow>
            <FormField
              id="entry-start"
              label="Start time"
              required
              error={errors.startTime}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="startTime"
                  type="time"
                  defaultValue={entry?.startTime ?? "09:00"}
                  required
                />
              )}
            </FormField>

            <FormField
              id="entry-end"
              label="End time"
              required
              error={errors.endTime}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="endTime"
                  type="time"
                  defaultValue={entry?.endTime ?? "10:00"}
                  required
                />
              )}
            </FormField>
          </FieldRow>

          <FieldRow>
            <FormField id="entry-room" label="Room" error={errors.room}>
              {(props) => (
                <TextInput
                  {...props}
                  name="room"
                  defaultValue={entry?.room ?? ""}
                  placeholder="204"
                  maxLength={60}
                  autoComplete="off"
                />
              )}
            </FormField>

            <FormField
              id="entry-instructor"
              label="Instructor"
              error={errors.instructor}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="instructor"
                  defaultValue={entry?.instructor ?? ""}
                  placeholder="Dr. R. Menon"
                  maxLength={120}
                  autoComplete="off"
                />
              )}
            </FormField>
          </FieldRow>
        </>
      )}
    </FormDialog>
  );
}
