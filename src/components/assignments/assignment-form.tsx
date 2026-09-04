"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { createAssignment, updateAssignment } from "@/actions/assignments";
import {
  ASSIGNMENT_STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/components/shared/badges";
import {
  FormSelect,
  optionsFromLabels,
  TextArea,
  TextInput,
} from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { FieldRow, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import type { AssignmentStatus, Priority } from "@/generated/prisma/enums";
import { formatDateInput, formatTimeInput } from "@/lib/date";
import type { SubjectRef } from "@/lib/db/queries";
import { subjectColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils";

export type AssignmentFormValues = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  dueDate: Date;
  priority: Priority;
  status: AssignmentStatus;
  submissionUrl: string | null;
};

export function subjectOptions(subjects: readonly SubjectRef[]) {
  return subjects.map((subject) => ({
    value: subject.id,
    label: `${subject.name} · ${subject.code}`,
    adornment: (
      <span
        className={cn("size-2.5 rounded-full", subjectColor(subject.color).dot)}
        aria-hidden
      />
    ),
  }));
}

export function AssignmentFormDialog({
  subjects,
  assignment,
  defaultSubjectId,
  trigger,
}: {
  subjects: readonly SubjectRef[];
  assignment?: AssignmentFormValues;
  defaultSubjectId?: string;
  trigger?: ReactNode;
}) {
  const editing = assignment !== undefined;
  const disabled = subjects.length === 0;

  const defaultDue = assignment?.dueDate ?? defaultDueDate();

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
                Add assignment
              </>
            )}
          </Button>
        )
      }
      title={editing ? "Edit assignment" : "Add an assignment"}
      description={
        editing
          ? "Update the details. Marking it complete records the time you did so."
          : "Coursework with a deadline. It appears on your dashboard and in Today as the due date approaches."
      }
      action={editing ? updateAssignment : createAssignment}
      submitLabel={editing ? "Save changes" : "Add assignment"}
    >
      {(errors) => (
        <>
          {editing ? (
            <input type="hidden" name="id" value={assignment.id} />
          ) : null}

          <FormField id="assignment-title" label="Title" required error={errors.title}>
            {(props) => (
              <TextInput
                {...props}
                name="title"
                defaultValue={assignment?.title}
                placeholder="Database normalization worksheet"
                maxLength={200}
                autoComplete="off"
                required
              />
            )}
          </FormField>

          <FormField
            id="assignment-subject"
            label="Subject"
            required
            error={errors.subjectId}
          >
            {(props) => (
              <FormSelect
                {...props}
                name="subjectId"
                options={subjectOptions(subjects)}
                defaultValue={assignment?.subjectId ?? defaultSubjectId}
                placeholder="Choose a subject"
                required
              />
            )}
          </FormField>

          <FieldRow>
            <FormField
              id="assignment-due-date"
              label="Due date"
              required
              error={errors.dueDate}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="dueDate"
                  type="date"
                  defaultValue={formatDateInput(defaultDue)}
                  required
                />
              )}
            </FormField>

            <FormField
              id="assignment-due-time"
              label="Due time"
              required
              error={errors.dueTime}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="dueTime"
                  type="time"
                  defaultValue={formatTimeInput(defaultDue)}
                  required
                />
              )}
            </FormField>
          </FieldRow>

          <FieldRow>
            <FormField id="assignment-priority" label="Priority" error={errors.priority}>
              {(props) => (
                <FormSelect
                  {...props}
                  name="priority"
                  options={optionsFromLabels(PRIORITY_LABELS)}
                  defaultValue={assignment?.priority ?? "MEDIUM"}
                />
              )}
            </FormField>

            <FormField id="assignment-status" label="Status" error={errors.status}>
              {(props) => (
                <FormSelect
                  {...props}
                  name="status"
                  options={optionsFromLabels(ASSIGNMENT_STATUS_LABELS)}
                  defaultValue={assignment?.status ?? "PENDING"}
                />
              )}
            </FormField>
          </FieldRow>

          <FormField
            id="assignment-description"
            label="Description"
            error={errors.description}
          >
            {(props) => (
              <TextArea
                {...props}
                name="description"
                defaultValue={assignment?.description ?? ""}
                placeholder="What needs doing, and anything you need to remember."
                rows={3}
                maxLength={2000}
              />
            )}
          </FormField>

          <FormField
            id="assignment-url"
            label="Submission link"
            hint="Where you hand it in — a portal, a form, a shared drive."
            error={errors.submissionUrl}
          >
            {(props) => (
              <TextInput
                {...props}
                name="submissionUrl"
                type="url"
                inputMode="url"
                defaultValue={assignment?.submissionUrl ?? ""}
                placeholder="https://"
              />
            )}
          </FormField>
        </>
      )}
    </FormDialog>
  );
}

/** New assignments default to 11:59 pm tomorrow — the most common real answer. */
function defaultDueDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(23, 59, 0, 0);
  return date;
}
