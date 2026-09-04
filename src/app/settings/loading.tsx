import { PageHeaderSkeleton } from "@/components/shared/skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeaderSkeleton />
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="gap-3 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="mt-2 h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ))}
    </div>
  );
}
