"use client";

import { Loader2 } from "lucide-react";
import Link, { type LinkProps } from "next/link";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { IDLE, type ActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The frame both credential forms share: heading, a server-error region, the
 * fields, the submit button and the link to the other page.
 *
 * The two forms differ only in their fields and their wording, so everything
 * else — including the parts that are easy to get subtly wrong, like where the
 * error is announced and when the button disables — is written once.
 */
export function AuthCard({
  title,
  description,
  action,
  submitLabel,
  pendingLabel,
  footer,
  children,
}: {
  title: string;
  description: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel: string;
  footer: ReactNode;
  children: (fieldErrors: Record<string, string[]> | undefined) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  /*
   * When a failure belongs to a field, the field says so and the banner stays
   * quiet. Showing both puts the identical sentence on screen twice, a few
   * pixels apart, and a screen reader reads it out twice — once from the alert
   * and again from the field it describes.
   *
   * A failure with no field to attach to — wrong credentials, a database that
   * did not answer — has nowhere else to go, so the banner shows that.
   */
  const bannerMessage =
    state.status === "error" && !fieldErrors ? state.message : null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1.5">
        {/*
         * `asChild` so the card's title is a real <h1>. These pages are the
         * whole document — there is no shell heading above them — so without
         * this the login screen has no heading at all, and anyone navigating by
         * headings lands on a page that appears to be about nothing.
         */}
        <CardTitle asChild className="text-xl">
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4" noValidate>
          {/*
           * The server's message, not a toast: a failed login has to stay on
           * screen while the student retypes. `role="alert"` announces it the
           * moment it appears, and the region is only rendered when there is
           * something to say so it is never an empty landmark.
           */}
          {bannerMessage ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm font-medium"
            >
              {bannerMessage}
            </p>
          ) : null}

          {children(fieldErrors)}

          <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
        </form>

        <p className="text-muted-foreground mt-5 text-center text-sm">
          {footer}
        </p>
      </CardContent>
    </Card>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

export function AuthFooterLink({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: LinkProps<string>["href"];
  label: string;
}) {
  return (
    <>
      {prompt}{" "}
      <Link
        href={href}
        className="text-foreground focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        {label}
      </Link>
    </>
  );
}
