import {
  ListSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/shared/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ListSkeleton />
        </div>
        <div className="lg:col-span-2">
          <ListSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
