import { cn } from '@/lib/utils';

export function TeamCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card">
      {/* Header skeleton */}
      <div className="h-20 bg-gradient-to-r from-muted to-muted/60 animate-pulse">
        {/* Badge skeleton */}
        <div className="absolute top-3 right-3">
          <div className="h-5 w-16 rounded-full bg-white/20 animate-pulse" />
        </div>
        
        {/* Avatar skeleton */}
        <div className="absolute -bottom-8 left-6">
          <div className="h-16 w-16 rounded-2xl bg-muted animate-pulse ring-4 ring-background" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="pt-12 pb-5 px-6">
        <div className="space-y-3 mb-4">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </div>

        {/* Members preview skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-9 rounded-full bg-muted animate-pulse ring-2 ring-background"
                style={{ zIndex: 3 - i }}
              />
            ))}
          </div>
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function TeamCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <TeamCardSkeleton key={i} />
      ))}
    </div>
  );
}