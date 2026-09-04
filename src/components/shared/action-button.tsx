"use client";

import { Loader2 } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";

import type { ActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A button that runs a server action and reports the outcome as a toast.
 *
 * Used for the one-tap operations — mark present, tick a task off, set an
 * assignment in progress — where opening a form would be absurd. It disables
 * itself while in flight so a double tap cannot fire twice.
 */
export function ActionButton({
  action,
  children,
  pendingLabel,
  className,
  variant = "outline",
  size = "sm",
  title,
  ariaLabel,
  disabled,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    try {
      const result = await action();
      if (result.status === "success") toast.success(result.message);
      else if (result.status === "error") toast.error(result.message);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      title={title}
      aria-label={ariaLabel}
      disabled={pending || disabled}
      onClick={() => void run()}
      className={cn(className)}
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {pendingLabel ?? "Working…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** The checkbox-style toggle used to complete a task or assignment in place. */
export function ToggleCompleteButton({
  completed,
  action,
  label,
}: {
  completed: boolean;
  action: () => Promise<ActionState>;
  label: string;
}) {
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    try {
      const result = await action();
      if (result.status === "success") toast.success(result.message);
      else if (result.status === "error") toast.error(result.message);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={completed}
      aria-label={label}
      disabled={pending}
      onClick={() => void run()}
      className={cn(
        "focus-visible:ring-ring mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60",
        completed
          ? "border-success bg-success text-success-foreground"
          : "border-muted-foreground/40 hover:border-primary",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : completed ? (
        <svg
          viewBox="0 0 12 12"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      ) : null}
    </button>
  );
}
