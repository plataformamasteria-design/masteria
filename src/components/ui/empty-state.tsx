import { LucideIcon } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        'animate-in fade-in-50 duration-300',
        className
      )}
    >
      <div className="rounded-full bg-muted p-6 mb-4 animate-in zoom-in-95 duration-300 delay-75">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2 animate-in fade-in-50 duration-300 delay-100">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 animate-in fade-in-50 duration-300 delay-150">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="animate-in fade-in-50 duration-300 delay-200"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
