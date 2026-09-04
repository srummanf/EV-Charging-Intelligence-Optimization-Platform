import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-12">
      {/* header / hero */}
      <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
        <div className="max-w-2xl space-y-4">
          <Skeleton className="h-5 w-56 rounded-full" />
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-10 w-40 rounded-full" />
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-40 w-full shrink-0 rounded-[20px] lg:w-72" />
      </div>

      {/* stat grid */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border bg-border lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* metric row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[360px] rounded-[28px] lg:col-span-2" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[172px] flex-1 rounded-[24px]" />
          <Skeleton className="h-[172px] flex-1 rounded-[24px]" />
        </div>
      </div>
    </div>
  );
}
