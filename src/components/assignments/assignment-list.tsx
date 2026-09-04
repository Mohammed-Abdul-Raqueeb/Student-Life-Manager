import { CalendarClock, ExternalLink, Loader, Trash2 } from "lucide-react";

import { deleteAssignment, setAssignmentStatus } from "@/actions/assignments";
import { deleteTask, setTaskStatus } from "@/actions/tasks";
import {
  ActionButton,
  ToggleCompleteButton,
} from "@/components/shared/action-button";
import {
  AssignmentStatusBadge,
  PriorityBadge,
  SubjectChip,
} from "@/components/shared/badges";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { AssignmentFormDialog } from "@/components/assignments/assignment-form";
import { TaskFormDialog } from "@/components/assignments/task-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, relativeDayLabel } from "@/lib/date";
import type { AssignmentRow, SubjectRef, TaskRow } from "@/lib/db/queries";
import { cn } from "@/lib/utils";
import { subjectPath } from "@/lib/routes";

/**
 * One assignment row.
 *
 * Overdue work is called out three ways at once — a red badge that says
 * "Overdue", red date text, and a red left edge — because it is the single most
 * consequential state in the app and must survive a glance, a greyscale screen
 * and a screen reader.
 */
export function AssignmentListItem({
  assignment,
  subjects,
  now,
}: {
  assignment: AssignmentRow;
  subjects: readonly SubjectRef[];
  now: Date;
}) {
  const completed = assignment.status === "COMPLETED";
  const overdue = !completed && assignment.dueDate < now;

  return (
    <li
      className={cn(
        "flex gap-3 border-l-2 px-4 py-4 transition-colors sm:px-5",
        overdue ? "border-l-destructive bg-destructive/[0.03]" : "border-l-transparent",
      )}
    >
      <ToggleCompleteButton
        completed={completed}
        label={
          completed
            ? `Reopen ${assignment.title}`
            : `Mark ${assignment.title} complete`
        }
        action={setAssignmentStatus.bind(
          null,
          assignment.id,
          completed ? "PENDING" : "COMPLETED",
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <p
            className={cn(
              "font-medium",
              completed && "text-muted-foreground line-through",
            )}
          >
            {assignment.title}
          </p>
          <AssignmentStatusBadge status={assignment.status} overdue={overdue} />
          {!completed ? <PriorityBadge priority={assignment.priority} /> : null}
        </div>

        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <SubjectChip
            subject={assignment.subject}
            showName
            href={subjectPath(assignment.subject.id)}
          />
          <span
            className={cn(
              "flex items-center gap-1",
              overdue && "text-destructive font-medium",
            )}
          >
            <CalendarClock className="size-3.5" aria-hidden />
            <span className="tabular">
              {relativeDayLabel(assignment.dueDate, now)}
            </span>
            <span className="hidden sm:inline">
              · {formatDateTime(assignment.dueDate)}
            </span>
          </span>
          {assignment.submissionUrl ? (
            <a
              href={assignment.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary flex items-center gap-1 underline underline-offset-2"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Submission link
            </a>
          ) : null}
        </div>

        {assignment.description ? (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
            {assignment.description}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {assignment.status === "PENDING" ? (
            <ActionButton
              action={setAssignmentStatus.bind(null, assignment.id, "IN_PROGRESS")}
              pendingLabel="Updating…"
            >
              <Loader className="size-3.5" aria-hidden />
              Start
            </ActionButton>
          ) : null}

          <AssignmentFormDialog
            subjects={subjects}
            assignment={{
              id: assignment.id,
              title: assignment.title,
              description: assignment.description,
              subjectId: assignment.subject.id,
              dueDate: assignment.dueDate,
              priority: assignment.priority,
              status: assignment.status,
              submissionUrl: assignment.submissionUrl,
            }}
          />

          <ConfirmAction
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${assignment.title}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            }
            title={`Delete "${assignment.title}"?`}
            description="This removes the assignment permanently. This cannot be undone."
            action={deleteAssignment.bind(null, assignment.id)}
          />
        </div>
      </div>
    </li>
  );
}

export function AssignmentList({
  assignments,
  subjects,
  now,
}: {
  assignments: readonly AssignmentRow[];
  subjects: readonly SubjectRef[];
  now: Date;
}) {
  return (
    <Card className="gap-0 p-0">
      <ul className="divide-y">
        {assignments.map((assignment) => (
          <AssignmentListItem
            key={assignment.id}
            assignment={assignment}
            subjects={subjects}
            now={now}
          />
        ))}
      </ul>
    </Card>
  );
}

export function TaskListItem({ task, now }: { task: TaskRow; now: Date }) {
  const completed = task.status === "COMPLETED";
  const overdue = !completed && task.dueDate !== null && task.dueDate < now;

  return (
    <li
      className={cn(
        "flex gap-3 border-l-2 px-4 py-4 sm:px-5",
        overdue ? "border-l-destructive bg-destructive/[0.03]" : "border-l-transparent",
      )}
    >
      <ToggleCompleteButton
        completed={completed}
        label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
        action={setTaskStatus.bind(
          null,
          task.id,
          completed ? "PENDING" : "COMPLETED",
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <p
            className={cn(
              "font-medium",
              completed && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </p>
          {overdue ? (
            <span className="bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              Overdue
            </span>
          ) : null}
          {!completed ? <PriorityBadge priority={task.priority} /> : null}
        </div>

        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {task.dueDate ? (
            <span
              className={cn(
                "flex items-center gap-1",
                overdue && "text-destructive font-medium",
              )}
            >
              <CalendarClock className="size-3.5" aria-hidden />
              <span className="tabular">{relativeDayLabel(task.dueDate, now)}</span>
              <span className="hidden sm:inline">
                · {formatDateTime(task.dueDate)}
              </span>
            </span>
          ) : (
            <span>No due date</span>
          )}
        </div>

        {task.description ? (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
            {task.description}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <TaskFormDialog
            task={{
              id: task.id,
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
              priority: task.priority,
              status: task.status,
            }}
          />
          <ConfirmAction
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${task.title}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            }
            title={`Delete "${task.title}"?`}
            description="This removes the task permanently. This cannot be undone."
            action={deleteTask.bind(null, task.id)}
          />
        </div>
      </div>
    </li>
  );
}

export function TaskList({
  tasks,
  now,
}: {
  tasks: readonly TaskRow[];
  now: Date;
}) {
  return (
    <Card className="gap-0 p-0">
      <ul className="divide-y">
        {tasks.map((task) => (
          <TaskListItem key={task.id} task={task} now={now} />
        ))}
      </ul>
    </Card>
  );
}
