"use client";

interface SkeletonProps {
  className?: string;
}

/** Shimmer loading placeholder. Uses the .skeleton class from globals.css. */
export default function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

/** Skeleton rows for the pool table list view */
export function PoolTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="px-5 py-3 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4" style={{ opacity: 1 - i * 0.08 }}>
          <Skeleton className="w-6 h-4" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="w-12 h-4" />
          <Skeleton className="w-16 h-5" />
          <Skeleton className="w-14 h-4 hidden sm:block" />
          <Skeleton className="w-14 h-4 hidden sm:block" />
          <Skeleton className="w-16 h-4" />
          <Skeleton className="w-20 h-4 hidden md:block" />
          <Skeleton className="w-16 h-4" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton cards for portfolio positions */
export function PositionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface/50 rounded-xl border border-white/5 p-4" style={{ opacity: 1 - i * 0.15 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
            <div className="space-y-1.5 flex flex-col items-end">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
      ))}
    </div>
  );
}
