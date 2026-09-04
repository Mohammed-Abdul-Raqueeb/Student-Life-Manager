import { CheckCircle2, ClipboardList, ListTodo } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";

import { AssignmentFilters } from "@/components/assignments/assignment-filters";
import { AssignmentFormDialog } from "@/components/assignments/assignment-form";
import { AssignmentList, TaskList } from "@/components/assignments/assignment-list";
import { TaskFormDialog } from "@/components/assignments/task-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card } from "@/components/ui/card";
import type {
  AssignmentStatus,
  Priority,
} from "@/generated/prisma/enums";
import { getAssignments, getSubjectRefs, getTasks } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Assignments" };

const STATUSES: AssignmentStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];

export default async function AssignmentsPage({
  searchParams,
}: PageProps<"/assignments">) {
  const params = await searchParams;
  const now = new Date();

  const status = pickOne(params.status, STATUSES);
  const priority = pickOne(params.priority, PRIORITIES);
  const subjectId = firstValue(params.subject);
  const search = firstValue(params.q);
  const sort = pickOne(firstValue(params.sort), [
    "dueDate",
    "priority",
    "created",
  ] as const);
  const showTasks = firstValue(params.tab) === "tasks";

  const [subjects, assignments, tasks, allAssignments] = await Promise.all([
    getSubjectRefs(),
    getAssignments({
      subjectId,
      status,
      priority,
      search,
      sort: sort ?? "dueDate",
    }),
    getTasks(),
    getAssignments(),
  ]);

  const isFiltered = Boolean(subjectId || status || priority || search);
  const overdue = allAssignments.filter(
    (a) => a.status !== "COMPLETED" && a.dueDate < now,
  ).length;
  const dueSoon = allAssignments.filter(
    (a) =>
      a.status !== "COMPLETED" &&
      a.dueDate >= now &&
      a.dueDate.getTime() - now.getTime() <= 3 * 86_400_000,
  ).length;
  const openTasks = tasks.filter((t) => t.status === "PENDING").length;

  return (
    <>
      <PageHeader
        title="Assignments & tasks"
        description="Coursework with deadlines, plus the general to-dos that keep a term running."
        actions={
          <>
            <AssignmentFormDialog subjects={subjects} />
            <TaskFormDialog />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Overdue"
          value={overdue}
          icon={ClipboardList}
          tone={overdue > 0 ? "critical" : "success"}
          hint={overdue > 0 ? "Needs attention now" : "Nothing overdue"}
        />
        <StatCard
          label="Due in 3 days"
          value={dueSoon}
          tone={dueSoon > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Open assignments"
          value={
            allAssignments.filter((a) => a.status !== "COMPLETED").length
          }
        />
        <StatCard label="Open tasks" value={openTasks} icon={ListTodo} />
      </div>

      {/* Tabs are links, not client state, so a filtered view stays linkable. */}
      <div
        role="tablist"
        aria-label="Assignments or tasks"
        className="bg-muted mb-5 inline-flex rounded-lg p-1"
      >
        <TabLink href="/assignments" active={!showTasks}>
          Assignments ({allAssignments.length})
        </TabLink>
        <TabLink href="/assignments?tab=tasks" active={showTasks}>
          Tasks ({tasks.length})
        </TabLink>
      </div>

      {showTasks ? (
        <section aria-labelledby="tasks-heading">
          <SectionHeader
            id="tasks-heading"
            title="Tasks"
            description="Undated tasks sort to the bottom — they are to-dos, not deadlines."
            action={<TaskFormDialog />}
          />
          {tasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="No tasks yet"
              description="Add a task for anything academic that is not coursework — a scholarship form, a chapter to read, a group meeting to arrange."
              action={<TaskFormDialog />}
            />
          ) : (
            <TaskList tasks={tasks} now={now} />
          )}
        </section>
      ) : (
        <section aria-labelledby="assignments-heading" className="space-y-5">
          <SectionHeader
            id="assignments-heading"
            title="Assignments"
            description="Overdue work is highlighted and sorts to the top of the due-date view."
          />

          <AssignmentFilters subjects={subjects} />

          {allAssignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No assignments yet"
              description="Add your first assignment to start tracking upcoming deadlines. It will show up on your dashboard and in Today as the due date approaches."
              action={
                subjects.length > 0 ? (
                  <AssignmentFormDialog subjects={subjects} />
                ) : (
                  <AddSubjectFirst />
                )
              }
            />
          ) : assignments.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing matches these filters"
              description={
                isFiltered
                  ? "Try widening the filters or clearing the search to see the rest of your assignments."
                  : "Every assignment is accounted for."
              }
              compact
            />
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                Showing {assignments.length} of {allAssignments.length}{" "}
                {allAssignments.length === 1 ? "assignment" : "assignments"}
              </p>
              <AssignmentList
                assignments={assignments}
                subjects={subjects}
                now={now}
              />
            </>
          )}
        </section>
      )}
    </>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: Route;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={
        active
          ? "bg-background rounded-md px-3.5 py-1.5 text-sm font-medium shadow-sm"
          : "text-muted-foreground hover:text-foreground rounded-md px-3.5 py-1.5 text-sm font-medium"
      }
    >
      {children}
    </Link>
  );
}

function AddSubjectFirst() {
  return (
    <Card className="p-4 text-sm">
      Assignments belong to a subject.{" "}
      <Link href="/subjects" className="text-primary font-medium underline">
        Add a subject first
      </Link>
      .
    </Card>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value === "" ? undefined : value;
}

function pickOne<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const first = firstValue(value);
  return first !== undefined && (allowed as readonly string[]).includes(first)
    ? (first as T)
    : undefined;
}
