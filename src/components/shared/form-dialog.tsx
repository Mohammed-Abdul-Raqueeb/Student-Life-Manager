"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import {
  useActionState,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { IDLE, type ActionState, type FieldErrors } from "@/actions/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ServerFormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * The dialog every create/edit form in the app uses.
 *
 * It owns the parts that are easy to get subtly wrong and tedious to repeat:
 * the pending state on the submit button, field-level errors echoed back from
 * the server, a form-level error banner, a success toast, and closing the
 * dialog only once the mutation has actually succeeded. The body is remounted
 * on every open (via `key`), so yesterday's validation errors never greet you
 * when you reopen the form.
 */
export function FormDialog({
  trigger,
  title,
  description,
  action,
  submitLabel,
  children,
  className,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  action: ServerFormAction;
  submitLabel: string;
  children: (errors: FieldErrors) => ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [instance, setInstance] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setInstance((n) => n + 1);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(
          "max-h-[92dvh] gap-0 overflow-y-auto sm:max-w-lg",
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <DialogFormBody
          key={instance}
          action={action}
          submitLabel={submitLabel}
          onDone={() => setOpen(false)}
        >
          {children}
        </DialogFormBody>
      </DialogContent>
    </Dialog>
  );
}

function DialogFormBody({
  action,
  submitLabel,
  onDone,
  children,
}: {
  action: ServerFormAction;
  submitLabel: string;
  onDone: () => void;
  children: (errors: FieldErrors) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const errorId = useId();

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  const formError =
    state.status === "error" && !state.fieldErrors ? state.message : null;
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="space-y-5 pt-2">
      {formError ? (
        <p
          id={errorId}
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formError}
        </p>
      ) : null}

      <div className="space-y-4">{children(fieldErrors)}</div>

      <DialogFooter className="gap-2 pt-1 sm:gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton>{submitLabel}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

/** Disables itself and shows a spinner while its enclosing form is submitting. */
export function SubmitButton({
  children,
  className,
  variant,
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "destructive";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      variant={variant}
      className={className}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Saving…
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/**
 * A standalone form (not in a dialog) — used by the Settings page, where each
 * card saves on its own.
 */
export function InlineForm({
  action,
  submitLabel,
  children,
  className,
  footer,
}: {
  action: ServerFormAction;
  submitLabel: string;
  children: (errors: FieldErrors) => ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const errorId = useId();

  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
  }, [state]);

  const formError =
    state.status === "error" && !state.fieldErrors ? state.message : null;
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className={cn("space-y-5", className)}>
      {formError ? (
        <p
          id={errorId}
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formError}
        </p>
      ) : null}

      <div className="space-y-4">{children(fieldErrors)}</div>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        {footer}
      </div>
    </form>
  );
}
