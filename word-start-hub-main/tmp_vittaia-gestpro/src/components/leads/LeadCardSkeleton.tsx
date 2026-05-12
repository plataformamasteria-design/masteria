import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LeadCardSkeleton({ isGroup = false }: { isGroup?: boolean }) {
  return (
    <Card className={cn(
      "relative overflow-hidden",
      isGroup && "border-l-4 border-l-muted"
    )}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with Avatar and Name */}
          <div className="flex items-start gap-3">
            <div className={cn(
              "h-12 w-12 rounded-full animate-pulse",
              isGroup ? "bg-green-500/20" : "bg-primary/20"
            )} />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                {isGroup && <div className="h-3.5 w-3.5 bg-green-500/20 animate-pulse rounded" />}
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              {isGroup && (
                <div className="h-5 w-28 bg-green-500/10 animate-pulse rounded-full" />
              )}
              <div className="h-5 w-20 bg-muted animate-pulse rounded mt-1" />
            </div>
            <div className="h-6 w-10 bg-muted animate-pulse rounded-full" />
          </div>

          {/* Assigned info */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 bg-muted animate-pulse rounded" />
              <div className="h-5 w-5 bg-muted animate-pulse rounded-full" />
              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            </div>
          </div>

          {/* Counters */}
          <div className="flex items-center gap-3">
            <div className="h-4 w-16 bg-green-500/10 animate-pulse rounded" />
            <div className="h-4 w-8 bg-muted animate-pulse rounded" />
            <div className="h-4 w-8 bg-muted animate-pulse rounded" />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-14 bg-muted animate-pulse rounded-full" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            <div className="flex items-center gap-2">
              <div className="h-7 w-16 bg-muted animate-pulse rounded" />
              <div className="h-7 w-7 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GroupCardSkeleton() {
  return <LeadCardSkeleton isGroup />;
}

export function LeadCardSkeletonGrid({ count = 6, mixed = true }: { count?: number; mixed?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 max-w-full">
      {Array.from({ length: count }).map((_, i) => (
        <LeadCardSkeleton key={i} isGroup={mixed && i % 3 === 0} />
      ))}
    </div>
  );
}