import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('w-full space-y-3', className)}>
      {showHeader && (
        <div className="flex gap-4 pb-3 border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`header-${i}`} className="h-4 flex-1" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 items-center">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              className={cn(
                'h-12',
                colIndex === 0 ? 'flex-[2]' : 'flex-1'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export function CardSkeleton({ count = 6, className }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`card-${i}`}
          className="rounded-lg border bg-card p-6 space-y-4"
        >
          <div className="flex items-center justify-center">
            <Skeleton className="h-16 w-16 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-3 w-1/2 mx-auto" />
          </div>
          <div className="flex gap-2 justify-center">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ListSkeletonProps {
  count?: number;
  showAvatar?: boolean;
  className?: string;
}

export function ListSkeleton({
  count = 5,
  showAvatar = true,
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`list-item-${i}`}
          className="flex items-center gap-4 p-4 rounded-lg border"
        >
          {showAvatar && <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
