import { Trash2 } from "lucide-react";

import { deleteAttendanceRecord } from "@/actions/attendance";
import { AttendanceStatusBadge, SubjectDot } from "@/components/shared/badges";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCalendarDate } from "@/lib/date";
import type { AttendanceHistoryRow } from "@/lib/db/queries";

/**
 * The attendance log.
 *
 * Rendered as a definition-style list rather than a `<table>`: on a phone a
 * four-column table either overflows or collapses into something a screen
 * reader reads badly, and each entry here is a small self-contained record.
 */
export function AttendanceHistory({
  records,
}: {
  records: readonly AttendanceHistoryRow[];
}) {
  return (
    <Card className="gap-0 p-0">
      <ul className="divide-y">
        {records.map((record) => (
          <li
            key={record.id}
            className="flex items-center gap-3 px-4 py-3 sm:px-5"
          >
            <SubjectDot color={record.subject.color} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {record.subject.name}
              </p>
              <p className="text-muted-foreground tabular text-xs">
                {formatCalendarDate(record.date, "EEE, MMM d, yyyy")}
                {record.note ? ` · ${record.note}` : ""}
              </p>
            </div>

            <AttendanceStatusBadge status={record.status} />

            <ConfirmAction
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Delete the ${record.subject.name} entry for ${formatCalendarDate(record.date)}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              }
              title="Delete this attendance record?"
              description={`The ${record.subject.name} entry for ${formatCalendarDate(record.date)} will be removed, and that class will no longer count as conducted.`}
              action={deleteAttendanceRecord.bind(null, record.id)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
