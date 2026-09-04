"use client";

import { Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { createTask, updateTask } from "@/actions/tasks";
import { PRIORITY_LABELS } from "@/components/shared/badges";
import {
  FormSelect,
  optionsFromLabels,
  TextArea,
  TextInput,
} from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { FieldRow, FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";
import { formatDateInput, formatTimeInput } from "@/lib/date";

export type TaskFormValues = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: Priority;
  status: TaskStatus;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
};

/**
 * Tasks are the catch-all: "prepare presentation", "submit scholarship form",
 * "meet project group". No subject, and the due date is optional — a task
 * without one is a to-do, not a deadline.
 */
export function TaskFormDialog({
  task,
  trigger,
}: {
  task?: TaskFormValues;
  trigger?: ReactNode;
}) {
  const editing = task !== undefined;

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button
            size={editing ? "sm" : "default"}
            variant={editing ? "outline" : "secondary"}
          >
            {editing ? (
              <>
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </>
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                Add task
              </>
            )}
          </Button>
        )
      }
      title={editing ? "Edit task" : "Add a task"}
      description={
        editing
          ? "Update the task."
          : "Anything academic that is not coursework — a form to submit, a chapter to read, a group to meet."
      }
      action={editing ? updateTask : createTask}
      submitLabel={editing ? "Save changes" : "Add task"}
    >
      {(errors) => (
        <>
          {editing ? <input type="hidden" name="id" value={task.id} /> : null}

          <FormField id="task-title" label="Title" required error={errors.title}>
            {(props) => (
              <TextInput
                {...props}
                name="title"
                defaultValue={task?.title}
                placeholder="Submit scholarship form"
                maxLength={200}
                autoComplete="off"
                required
              />
            )}
          </FormField>

          <FieldRow>
            <FormField
              id="task-due-date"
              label="Due date"
              hint="Optional — leave blank for an open task."
              error={errors.dueDate}
            >
              {(props) => (
                <TextInput
                  {...props}
                  name="dueDate"
                  type="date"
                  defaultValue={task?.dueDate ? formatDateInput(task.dueDate) : ""}
                />
              )}
            </FormField>

            <FormField id="task-due-time" label="Due time" error={errors.dueTime}>
              {(props) => (
                <TextInput
                  {...props}
                  name="dueTime"
                  type="time"
                  defaultValue={
                    task?.dueDate ? formatTimeInput(task.dueDate) : "23:59"
                  }
                />
              )}
            </FormField>
          </FieldRow>

          <FieldRow>
            <FormField id="task-priority" label="Priority" error={errors.priority}>
              {(props) => (
                <FormSelect
                  {...props}
                  name="priority"
                  options={optionsFromLabels(PRIORITY_LABELS)}
                  defaultValue={task?.priority ?? "MEDIUM"}
                />
              )}
            </FormField>

            <FormField id="task-status" label="Status" error={errors.status}>
              {(props) => (
                <FormSelect
                  {...props}
                  name="status"
                  options={optionsFromLabels(STATUS_LABELS)}
                  defaultValue={task?.status ?? "PENDING"}
                />
              )}
            </FormField>
          </FieldRow>

          <FormField
            id="task-description"
            label="Notes"
            error={errors.description}
          >
            {(props) => (
              <TextArea
                {...props}
                name="description"
                defaultValue={task?.description ?? ""}
                rows={3}
                maxLength={2000}
                placeholder="Anything you need to remember."
              />
            )}
          </FormField>
        </>
      )}
    </FormDialog>
  );
}
