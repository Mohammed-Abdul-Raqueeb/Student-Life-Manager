import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholders that match the real layout's dimensions, so nothing
 * jumps when the data arrives.
 */

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2 sm:mb-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="gap-0 p-4 sm:p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-8 w-16" />
        </Card>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="gap-0 divide-y p-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <Skeleton className="size-5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </Card>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="gap-3 p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-16" />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <Skeleton className="w-full rounded-xl" style={{ height }} />;
}

/** The generic page-level fallback used by `loading.tsx` files. */
export function PageSkeleton({ stats = 4 }: { stats?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={stats} />
      <ListSkeleton />
    </div>
  );
}
