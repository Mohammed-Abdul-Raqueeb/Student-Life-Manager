import { Trash2 } from "lucide-react";

import { deleteNote } from "@/actions/notes";
import { SubjectChip } from "@/components/shared/badges";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { NoteFormDialog } from "@/components/notes/note-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/date";
import type { NoteRow, SubjectRef } from "@/lib/db/queries";
import { subjectPath } from "@/lib/routes";

/**
 * Notes as cards.
 *
 * Content is rendered as plain text with line breaks preserved (`whitespace-
 * pre-line`) and clamped to a preview. Markdown was deliberately left out
 * rather than shipped unsanitised — rendering user HTML safely is a decision
 * that deserves its own pass, not a default.
 */
export function NoteList({
  notes,
  subjects,
}: {
  notes: readonly NoteRow[];
  subjects: readonly SubjectRef[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} subjects={subjects} />
      ))}
    </div>
  );
}

export function NoteCard({
  note,
  subjects,
}: {
  note: NoteRow;
  subjects: readonly SubjectRef[];
}) {
  const edited = note.updatedAt.getTime() - note.createdAt.getTime() > 60_000;

  return (
    <Card className="gap-0 p-0">
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="leading-tight font-semibold">{note.title}</h3>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {note.subject ? (
            <SubjectChip
              subject={note.subject}
              showName
              href={subjectPath(note.subject.id)}
            />
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              General
            </Badge>
          )}
          <span className="text-muted-foreground text-xs">
            {edited
              ? `Updated ${formatDate(note.updatedAt)}`
              : `Added ${formatDate(note.createdAt)}`}
          </span>
        </div>

        <p className="text-muted-foreground mt-3 line-clamp-6 text-sm whitespace-pre-line">
          {note.content}
        </p>
      </div>

      <div className="flex items-center gap-2 border-t px-5 py-3">
        <NoteFormDialog
          subjects={subjects}
          note={{
            id: note.id,
            title: note.title,
            content: note.content,
            subjectId: note.subject?.id ?? null,
          }}
        />
        <ConfirmAction
          trigger={
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive ml-auto"
              aria-label={`Delete ${note.title}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          }
          title={`Delete "${note.title}"?`}
          description="This removes the note permanently. This cannot be undone."
          action={deleteNote.bind(null, note.id)}
        />
      </div>
    </Card>
  );
}
