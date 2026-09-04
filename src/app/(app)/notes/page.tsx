import { NotebookPen, SearchX } from "lucide-react";
import type { Metadata } from "next";

import { NoteFilters } from "@/components/notes/note-filters";
import { NoteFormDialog } from "@/components/notes/note-form";
import { NoteList } from "@/components/notes/note-list";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getNotes, getSubjectRefs } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const params = await searchParams;
  const subjectParam = firstValue(params.subject);
  const search = firstValue(params.q);

  const [subjects, notes, allNotes] = await Promise.all([
    getSubjectRefs(),
    getNotes({
      search,
      general: subjectParam === "general",
      subjectId:
        subjectParam && subjectParam !== "general" ? subjectParam : undefined,
    }),
    getNotes(),
  ]);

  const isFiltered = Boolean(subjectParam || search);

  return (
    <>
      <PageHeader
        title="Notes"
        description="Notes by subject, plus general notes that do not belong to a course."
        actions={<NoteFormDialog subjects={subjects} />}
      />

      {allNotes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No notes yet"
          description="Write your first note. Attach it to a subject to find it later from that subject's page, or keep it general."
          action={<NoteFormDialog subjects={subjects} />}
        />
      ) : (
        <div className="space-y-5">
          <NoteFilters subjects={subjects} />

          {notes.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No notes match"
              description={
                isFiltered
                  ? "Try a different search term, or clear the filters to see all of your notes."
                  : "Nothing here yet."
              }
              compact
            />
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                {notes.length === allNotes.length
                  ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}`
                  : `Showing ${notes.length} of ${allNotes.length} notes`}
              </p>
              <NoteList notes={notes} subjects={subjects} />
            </>
          )}
        </div>
      )}
    </>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value === "" ? undefined : value;
}
