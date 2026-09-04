"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { createNote, updateNote } from "@/actions/notes";
import { subjectOptions } from "@/components/assignments/assignment-form";
import {
  FormSelect,
  TextArea,
  TextInput,
} from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import type { SubjectRef } from "@/lib/db/queries";

export type NoteFormValues = {
  id: string;
  title: string;
  content: string;
  subjectId: string | null;
};

export function NoteFormDialog({
  subjects,
  note,
  defaultSubjectId,
  trigger,
}: {
  subjects: readonly SubjectRef[];
  note?: NoteFormValues;
  defaultSubjectId?: string;
  trigger?: ReactNode;
}) {
  const editing = note !== undefined;

  return (
    <FormDialog
      className="sm:max-w-2xl"
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
                New note
              </>
            )}
          </Button>
        )
      }
      title={editing ? "Edit note" : "New note"}
      description={
        editing
          ? "Changes are saved with a new timestamp."
          : "Attach it to a subject, or leave the subject unset for a general note."
      }
      action={editing ? updateNote : createNote}
      submitLabel={editing ? "Save changes" : "Save note"}
    >
      {(errors) => (
        <>
          {editing ? <input type="hidden" name="id" value={note.id} /> : null}

          <FormField id="note-title" label="Title" required error={errors.title}>
            {(props) => (
              <TextInput
                {...props}
                name="title"
                defaultValue={note?.title}
                placeholder="Normal forms — 1NF to BCNF"
                maxLength={200}
                autoComplete="off"
                required
              />
            )}
          </FormField>

          <FormField id="note-subject" label="Subject" error={errors.subjectId}>
            {(props) => (
              <FormSelect
                {...props}
                name="subjectId"
                options={[
                  { value: "none", label: "General note (no subject)" },
                  ...subjectOptions(subjects),
                ]}
                defaultValue={note?.subjectId ?? defaultSubjectId ?? "none"}
              />
            )}
          </FormField>

          <FormField
            id="note-content"
            label="Note"
            required
            hint="Plain text. Line breaks are preserved."
            error={errors.content}
          >
            {(props) => (
              <TextArea
                {...props}
                name="content"
                defaultValue={note?.content}
                rows={12}
                maxLength={20000}
                placeholder="Write your note here."
                required
                className="min-h-56 font-normal"
              />
            )}
          </FormField>
        </>
      )}
    </FormDialog>
  );
}
