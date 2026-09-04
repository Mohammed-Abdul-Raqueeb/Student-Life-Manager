"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  ASSIGNMENT_STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/components/shared/badges";
import { FIELD_CLASS } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SubjectRef } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

const ALL = "all";

const SORT_LABELS = {
  dueDate: "Due date",
  priority: "Priority",
  created: "Recently added",
} as const;

/**
 * Filters live in the URL rather than in component state: the page stays a
 * server component, a filtered view is linkable, and the back button does what
 * you would expect. The search box debounces so typing does not fire a request
 * per keystroke.
 */
export function AssignmentFilters({
  subjects,
}: {
  subjects: readonly SubjectRef[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const current = {
    subject: params.get("subject") ?? ALL,
    status: params.get("status") ?? ALL,
    priority: params.get("priority") ?? ALL,
    sort: params.get("sort") ?? "dueDate",
  };

  function apply(next: Record<string, string | null>) {
    const updated = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === ALL || value === "") updated.delete(key);
      else updated.set(key, value);
    }
    const query = updated.toString();
    startTransition(() => {
      router.replace(query ? `?${query}` : "?", { scroll: false });
    });
  }

  // Debounce the search box; `apply` is intentionally not a dependency because
  // it closes over `params` and would restart the timer on every URL change.
  useEffect(() => {
    const currentQuery = params.get("q") ?? "";
    if (search === currentQuery) return;

    const timer = setTimeout(() => {
      const updated = new URLSearchParams(params.toString());
      if (search.trim() === "") updated.delete("q");
      else updated.set("q", search.trim());
      const query = updated.toString();
      startTransition(() => {
        router.replace(query ? `?${query}` : "?", { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, params, router]);

  const isFiltered =
    current.subject !== ALL ||
    current.status !== ALL ||
    current.priority !== ALL ||
    current.sort !== "dueDate" ||
    search !== "";

  return (
    <div
      className={cn(
        "space-y-3 transition-opacity",
        pending && "opacity-60",
      )}
    >
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Label htmlFor="assignment-search" className="sr-only">
          Search assignments
        </Label>
        <Input
          id="assignment-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search assignments by title or description"
          className={cn(FIELD_CLASS, "pl-9")}
          type="search"
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <FilterSelect
          id="filter-subject"
          label="Subject"
          value={current.subject}
          onChange={(value) => apply({ subject: value })}
          options={[
            { value: ALL, label: "All subjects" },
            ...subjects.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />

        <FilterSelect
          id="filter-status"
          label="Status"
          value={current.status}
          onChange={(value) => apply({ status: value })}
          options={[
            { value: ALL, label: "Any status" },
            ...Object.entries(ASSIGNMENT_STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />

        <FilterSelect
          id="filter-priority"
          label="Priority"
          value={current.priority}
          onChange={(value) => apply({ priority: value })}
          options={[
            { value: ALL, label: "Any priority" },
            ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />

        <FilterSelect
          id="filter-sort"
          label="Sort by"
          value={current.sort}
          onChange={(value) => apply({ sort: value })}
          options={Object.entries(SORT_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />

        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setSearch("");
              startTransition(() => router.replace("?", { scroll: false }));
            }}
          >
            <X className="size-3.5" aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 w-[9.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
