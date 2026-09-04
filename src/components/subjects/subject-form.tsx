"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { createSubject, updateSubject } from "@/actions/subjects";
import { FormDialog } from "@/components/shared/form-dialog";
import {
  FormSelect,
  TextInput,
  type SelectOption,
} from "@/components/shared/form-controls";
import { FieldRow, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import {
  nextSubjectColor,
  SUBJECT_COLOR_KEYS,
  SUBJECT_COLORS,
} from "@/lib/subject-colors";
import { cn } from "@/lib/utils";

export type SubjectFormValues = {
  id: string;
  name: string;
  code: string;
  credits: number;
  instructor: string | null;
  color: string;
};

const COLOR_OPTIONS: SelectOption[] = SUBJECT_COLOR_KEYS.map((key) => ({
  value: key,
  label: SUBJECT_COLORS[key].label,
  adornment: (
    <span
      className={cn("size-3 rounded-full", SUBJECT_COLORS[key].dot)}
      aria-hidden
    />
  ),
}));

export function SubjectFormDialog({
  subject,
  usedColors = [],
  trigger,
}: {
  subject?: SubjectFormValues;
  usedColors?: readonly string[];
  trigger?: ReactNode;
}) {
  const editing = subject !== undefined;

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
                Add subject
              </>
            )}
          </Button>
        )
      }
      title={editing ? "Edit subject" : "Add a subject"}
      description={
        editing
          ? "Update the course details. Attendance, marks and assignments are untouched."
          : "Courses are the backbone of everything else — assignments, exams, attendance and marks all hang off a subject."
      }
      action={editing ? updateSubject : createSubject}
      submitLabel={editing ? "Save changes" : "Add subject"}
    >
      {(errors) => (
        <>
          {editing ? <input type="hidden" name="id" value={subject.id} /> : null}

          <FormField id="subject-name" label="Subject name" required error={errors.name}>
            {(props) => (
              <TextInput
                {...props}
                name="name"
                defaultValue={subject?.name}
                placeholder="Database Systems"
                maxLength={120}
                autoComplete="off"
                required
              />
            )}
          </FormField>

          <FieldRow>
            <FormField
              id="subject-code"
              label="Subject code"
              required
              hint="Shown on compact cards and chips."
              error={errors.code}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="code"
                  defaultValue={subject?.code}
                  placeholder="CS301"
                  maxLength={20}
                  autoComplete="off"
                  className="uppercase"
                  required
                />
              )}
            </FormField>

            <FormField id="subject-credits" label="Credits" required error={errors.credits}>
              {(props) => (
                <TextInput
                  {...props}
                  name="credits"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={30}
                  step={1}
                  defaultValue={subject?.credits ?? 3}
                  required
                />
              )}
            </FormField>
          </FieldRow>

          <FormField id="subject-instructor" label="Instructor" error={errors.instructor}>
            {(props) => (
              <TextInput
                {...props}
                name="instructor"
                defaultValue={subject?.instructor ?? ""}
                placeholder="Dr. R. Menon"
                maxLength={120}
                autoComplete="off"
              />
            )}
          </FormField>

          <FormField
            id="subject-color"
            label="Accent colour"
            hint="Identifies this subject across the app. It never indicates status."
            error={errors.color}
          >
            {(props) => (
              <FormSelect
                {...props}
                name="color"
                options={COLOR_OPTIONS}
                defaultValue={subject?.color ?? nextSubjectColor(usedColors)}
              />
            )}
          </FormField>
        </>
      )}
    </FormDialog>
  );
}
