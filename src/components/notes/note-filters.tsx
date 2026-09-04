"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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
const GENERAL = "general";

/** Search and subject filter for notes, kept in the URL like the assignment filters. */
export function NoteFilters({ subjects }: { subjects: readonly SubjectRef[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const subject = params.get("subject") ?? ALL;

  function push(next: URLSearchParams) {
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `?${query}` : "?", { scroll: false });
    });
  }

  useEffect(() => {
    if (search === (params.get("q") ?? "")) return;
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

  const isFiltered = subject !== ALL || search !== "";

  return (
    <div className={cn("flex flex-wrap items-end gap-3", pending && "opacity-60")}>
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Label htmlFor="note-search" className="sr-only">
          Search notes
        </Label>
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id="note-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search titles and content"
          className={cn(FIELD_CLASS, "pl-9")}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="note-subject-filter" className="text-muted-foreground text-xs">
          Subject
        </Label>
        <Select
          value={subject}
          onValueChange={(value) => {
            const updated = new URLSearchParams(params.toString());
            if (value === ALL) updated.delete("subject");
            else updated.set("subject", value);
            push(updated);
          }}
        >
          <SelectTrigger id="note-subject-filter" className="h-9 w-[12rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All notes</SelectItem>
            <SelectItem value={GENERAL}>General only</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
  );
}
