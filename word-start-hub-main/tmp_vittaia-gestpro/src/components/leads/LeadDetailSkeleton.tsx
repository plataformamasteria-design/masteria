import { cn } from '@/lib/utils';

export function LeadDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-muted/60 p-6">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 rounded-2xl bg-muted-foreground/20" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-48 bg-muted-foreground/20 rounded" />
            <div className="h-4 w-32 bg-muted-foreground/20 rounded" />
            <div className="h-6 w-24 bg-muted-foreground/20 rounded-full" />
          </div>
          <div className="h-9 w-32 bg-muted-foreground/20 rounded-lg" />
        </div>
      </div>

      {/* Bot Status skeleton */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-3 w-32 bg-muted rounded" />
          </div>
        </div>
        <div className="h-6 w-12 bg-muted rounded-full" />
      </div>

      {/* Assignment skeleton */}
      <div className="p-4 rounded-xl bg-muted/30 space-y-3">
        <div className="h-5 w-20 bg-muted rounded" />
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Tags skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-20 bg-muted rounded-full" />
          ))}
        </div>
      </div>

      {/* Sections skeleton */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl bg-muted/30 space-y-3">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="h-4 w-40 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}