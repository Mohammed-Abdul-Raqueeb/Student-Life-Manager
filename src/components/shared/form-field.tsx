import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * One labelled control.
 *
 * The label is always a real `<label>` bound to the control's id, the hint and
 * the error are wired up through `aria-describedby`, and the error also sets
 * `aria-invalid` — so a screen reader announces the problem rather than just
 * reading a red border it cannot see.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string[];
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error?.length ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">(required)</span> : null}
      </Label>

      {children({
        id,
        "aria-describedby": describedBy,
        ...(error?.length ? { "aria-invalid": true as const } : {}),
      })}

      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}

      {error?.length ? (
        <p id={errorId} className="text-destructive text-xs font-medium">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

/** A responsive two-column row for short, related fields. */
export function FieldRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>
  );
}
