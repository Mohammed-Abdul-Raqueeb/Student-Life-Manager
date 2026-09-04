import { BookOpen } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SubjectNotFound() {
  return (
    <Card className="mx-auto mt-8 max-w-md items-center gap-3 p-8 text-center">
      <span className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-full">
        <BookOpen className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Subject not found</h1>
        <p className="text-muted-foreground text-sm">
          This subject has been deleted, or the link points at one that never
          existed.
        </p>
      </div>
      <Button asChild className="mt-1">
        <Link href="/subjects">Back to subjects</Link>
      </Button>
    </Card>
  );
}
