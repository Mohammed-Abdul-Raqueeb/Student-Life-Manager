"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * The last line of defence. A page's data fetch failing (the database being
 * unreachable, say) lands here — with a retry, and without leaking the raw
 * error text to the browser.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-8 max-w-md items-center gap-3 p-8 text-center">
      <span className="bg-destructive/10 text-destructive grid size-12 place-items-center rounded-full">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          We could not load this page. This is usually a temporary problem
          reaching the database.
        </p>
      </div>
      <Button onClick={reset} className="mt-1">
        <RotateCcw className="size-4" aria-hidden />
        Try again
      </Button>
      {error.digest ? (
        <p className="text-muted-foreground mt-1 text-xs">
          Reference: {error.digest}
        </p>
      ) : null}
    </Card>
  );
}
