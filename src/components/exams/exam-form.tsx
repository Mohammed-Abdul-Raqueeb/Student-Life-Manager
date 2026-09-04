"use client";

import { addDays, set } from "date-fns";
import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { createExam, updateExam } from "@/actions/exams";
import { subjectOptions } from "@/components/assignments/assignment-form";
import { EXAM_TYPE_LABELS } from "@/components/shared/badges";
import {
  FormSelect,
  optionsFromLabels,
  TextArea,
  TextInput,
} from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { FieldRow, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import type { ExamType } from "@/generated/prisma/enums";
import { formatDateInput, formatTimeInput, inAppZone } from "@/lib/date";
import type { SubjectRef } from "@/lib/db/queries";

export type ExamFormValues = {
  id: string;
  name: string;
  subjectId: string;
  type: ExamType;
  examDate: Date;
  durationMinutes: number | null;
  location: string | null;
  notes: string | null;
};

export function ExamFormDialog({
  subjects,
  exam,
  defaultSubjectId,
  trigger,
}: {
  subjects: readonly SubjectRef[];
  exam?: ExamFormValues;
  defaultSubjectId?: string;
  trigger?: ReactNode;
}) {
  const editing = exam !== undefined;
  const disabled = subjects.length === 0;
  const defaultAt = exam?.examDate ?? defaultExamDate();

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
                Add exam
              </>
            )}
          </Button>
        )
      }
      title={editing ? "Edit exam" : "Add an exam"}
      description={
        editing
          ? "Update the exam details."
          : "Quizzes, midterms, finals, practicals and vivas. The countdown starts as soon as you save."
      }
      action={editing ? updateExam : createExam}
      submitLabel={editing ? "Save changes" : "Add exam"}
    >
      {(errors) => (
        <>
          {editing ? <input type="hidden" name="id" value={exam.id} /> : null}

          <FormField id="exam-name" label="Exam name" required error={errors.name}>
            {(props) => (
              <TextInput
                {...props}
                name="name"
                defaultValue={exam?.name}
                placeholder="Final Exam"
                maxLength={200}
                autoComplete="off"
                required
              />
            )}
          </FormField>

          <FieldRow>
            <FormField
              id="exam-subject"
              label="Subject"
              required
              error={errors.subjectId}
            >
              {(props) => (
                <FormSelect
                  {...props}
                  name="subjectId"
                  options={subjectOptions(subjects)}
                  defaultValue={exam?.subjectId ?? defaultSubjectId}
                  placeholder="Choose a subject"
                  required
                />
              )}
            </FormField>

            <FormField id="exam-type" label="Exam type" error={errors.type}>
              {(props) => (
                <FormSelect
                  {...props}
                  name="type"
                  options={optionsFromLabels(EXAM_TYPE_LABELS)}
                  defaultValue={exam?.type ?? "QUIZ"}
                />
              )}
            </FormField>
          </FieldRow>

          <FieldRow>
            <FormField id="exam-date" label="Date" required error={errors.examDate}>
              {(props) => (
                <TextInput
                  {...props}
                  name="examDate"
                  type="date"
                  defaultValue={formatDateInput(defaultAt)}
                  required
                />
              )}
            </FormField>

            <FormField
              id="exam-time"
              label="Start time"
              required
              error={errors.examTime}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="examTime"
                  type="time"
                  defaultValue={formatTimeInput(defaultAt)}
                  required
                />
              )}
            </FormField>
          </FieldRow>

          <FieldRow>
            <FormField
              id="exam-duration"
              label="Duration"
              hint="In minutes. Optional."
              error={errors.durationMinutes}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="durationMinutes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1440}
                  step={5}
                  defaultValue={exam?.durationMinutes ?? ""}
                  placeholder="120"
                />
              )}
            </FormField>

            <FormField id="exam-location" label="Location" error={errors.location}>
              {(props) => (
                <TextInput
                  {...props}
                  name="location"
                  defaultValue={exam?.location ?? ""}
                  placeholder="Hall A"
                  maxLength={120}
                  autoComplete="off"
                />
              )}
            </FormField>
          </FieldRow>

          <FormField id="exam-notes" label="Notes" error={errors.notes}>
            {(props) => (
              <TextArea
                {...props}
                name="notes"
                defaultValue={exam?.notes ?? ""}
                rows={3}
                maxLength={2000}
                placeholder="Syllabus covered, what to bring, seat number."
              />
            )}
          </FormField>
        </>
      )}
    </FormDialog>
  );
}

/** New exams default to 9:00 am a week out. */
function defaultExamDate(): Date {
  const nextWeek = addDays(inAppZone(new Date()), 7);
  const at9am = set(nextWeek, {
    hours: 9,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });
  return new Date(at9am.getTime());
}
