"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import { resetGradingScale, updateGradingScale } from "@/actions/settings";
import { ActionButton } from "@/components/shared/action-button";
import { InlineForm } from "@/components/shared/form-dialog";
import { FIELD_CLASS } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GradeBand } from "@/lib/calculations/marks";
import { cn } from "@/lib/utils";

/**
 * The grading scale editor.
 *
 * Rows are plain `grade[]` / `minPercent[]` inputs, so adding and removing bands
 * is local state but saving is an ordinary form post — no client-side data model
 * to drift out of sync with the server, and the whole thing works with the
 * keyboard alone.
 */
export function GradingScaleEditor({ scale }: { scale: readonly GradeBand[] }) {
  const [rows, setRows] = useState<GradeBand[]>(() =>
    scale.length > 0 ? [...scale] : [{ grade: "", minPercent: 0 }],
  );

  return (
    <InlineForm
      action={updateGradingScale}
      submitLabel="Save grading scale"
      footer={
        <ActionButton
          action={resetGradingScale}
          variant="ghost"
          size="default"
          pendingLabel="Resetting…"
          className="text-muted-foreground"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset to default
        </ActionButton>
      }
    >
      {(errors) => (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
            <Label className="text-muted-foreground text-xs">Grade</Label>
            <Label className="text-muted-foreground text-xs">
              Minimum percent
            </Label>
            <span className="sr-only">Remove</span>
            <span aria-hidden />
          </div>

          {rows.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_1fr_auto] items-center gap-3"
            >
              <Input
                name="grade"
                aria-label={`Grade label ${index + 1}`}
                defaultValue={row.grade}
                placeholder="A+"
                maxLength={8}
                className={FIELD_CLASS}
              />
              <Input
                name="minPercent"
                aria-label={`Minimum percent for band ${index + 1}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="any"
                defaultValue={row.minPercent}
                className={FIELD_CLASS}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove band ${index + 1}`}
                disabled={rows.length === 1}
                onClick={() =>
                  setRows((current) => current.filter((_, i) => i !== index))
                }
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}

          {errors.bands?.length || errors.grade?.length || errors.minPercent?.length ? (
            <p className="text-destructive text-xs font-medium" role="alert">
              {errors.bands?.[0] ?? errors.grade?.[0] ?? errors.minPercent?.[0]}
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setRows((current) => [...current, { grade: "", minPercent: 0 }])
            }
            className={cn("w-full sm:w-auto")}
          >
            <Plus className="size-3.5" aria-hidden />
            Add band
          </Button>

          <p className="text-muted-foreground text-xs">
            Bands are sorted highest first when saved. A score is given the
            highest band whose minimum it reaches.
          </p>
        </div>
      )}
    </InlineForm>
  );
}
