"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { createAssessment, updateAssessment } from "@/actions/assessments";
import { subjectOptions } from "@/components/assignments/assignment-form";
import { ASSESSMENT_TYPE_LABELS } from "@/components/shared/badges";
import {
  FormSelect,
  optionsFromLabels,
  TextInput,
} from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { FieldRow, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import type { AssessmentType } from "@/generated/prisma/enums";
import { formatCalendarDateInput, formatDateInput } from "@/lib/date";
import type { SubjectRef } from "@/lib/db/queries";

export type AssessmentFormValues = {
  id: string;
  name: string;
  subjectId: string;
  type: AssessmentType;
  marksObtained: number;
  maxMarks: number;
  weightage: number;
  date: Date;
};

export function AssessmentFormDialog({
  subjects,
  assessment,
  defaultSubjectId,
  trigger,
}: {
  subjects: readonly SubjectRef[];
  assessment?: AssessmentFormValues;
  defaultSubjectId?: string;
  trigger?: ReactNode;
}) {
  const editing = assessment !== undefined;
  const disabled = subjects.length === 0;

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
                Record marks
              </>
            )}
          </Button>
        )
      }
      title={editing ? "Edit assessment" : "Record marks"}
      description={
        editing
          ? "Update the marks or weighting."
          : "Add a graded piece of work. Give it a weightage to have it count towards the subject's final grade."
      }
      action={editing ? updateAssessment : createAssessment}
      submitLabel={editing ? "Save changes" : "Record marks"}
    >
      {(errors) => (
        <>
          {editing ? (
            <input type="hidden" name="id" value={assessment.id} />
          ) : null}

          <FormField
            id="assessment-name"
            label="Assessment name"
            required
            error={errors.name}
          >
            {(props) => (
              <TextInput
                {...props}
                name="name"
                defaultValue={assessment?.name}
                placeholder="Midterm 1"
                maxLength={200}
                autoComplete="off"
                required
              />
            )}
          </FormField>

          <FieldRow>
            <FormField
              id="assessment-subject"
              label="Subject"
              required
              error={errors.subjectId}
            >
              {(props) => (
                <FormSelect
                  {...props}
                  name="subjectId"
                  options={subjectOptions(subjects)}
                  defaultValue={assessment?.subjectId ?? defaultSubjectId}
                  placeholder="Choose a subject"
                  required
                />
              )}
            </FormField>

            <FormField id="assessment-type" label="Type" error={errors.type}>
              {(props) => (
                <FormSelect
                  {...props}
                  name="type"
                  options={optionsFromLabels(ASSESSMENT_TYPE_LABELS)}
                  defaultValue={assessment?.type ?? "ASSIGNMENT"}
                />
              )}
            </FormField>
          </FieldRow>

          <FieldRow>
            <FormField
              id="assessment-obtained"
              label="Marks obtained"
              required
              error={errors.marksObtained}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="marksObtained"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  defaultValue={assessment?.marksObtained ?? ""}
                  placeholder="33"
                  required
                />
              )}
            </FormField>

            <FormField
              id="assessment-max"
              label="Maximum marks"
              required
              error={errors.maxMarks}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="maxMarks"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step="any"
                  defaultValue={assessment?.maxMarks ?? ""}
                  placeholder="40"
                  required
                />
              )}
            </FormField>
          </FieldRow>

          <FieldRow>
            <FormField
              id="assessment-weightage"
              label="Weightage"
              hint="Percent of the final grade. Leave at 0 if this subject is not weighted."
              error={errors.weightage}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="weightage"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="any"
                  defaultValue={assessment?.weightage ?? 0}
                />
              )}
            </FormField>

            <FormField
              id="assessment-date"
              label="Date"
              required
              error={errors.date}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="date"
                  type="date"
                  defaultValue={
                    assessment
                      ? formatCalendarDateInput(assessment.date)
                      : formatDateInput(new Date())
                  }
                  required
                />
              )}
            </FormField>
          </FieldRow>
        </>
      )}
    </FormDialog>
  );
}
