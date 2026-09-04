import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Card className="mx-auto mt-8 max-w-md items-center gap-3 p-8 text-center">
      <span className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-full">
        <Compass className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-muted-foreground text-sm">
          That page does not exist, or the record it pointed at has been deleted.
        </p>
      </div>
      <Button asChild className="mt-1">
        <Link href="/">Back to overview</Link>
      </Button>
    </Card>
  );
}
