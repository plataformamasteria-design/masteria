import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ResponsiveCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function ResponsiveCard({
  title,
  description,
  children,
  className,
  headerAction
}: ResponsiveCardProps) {
  return (
    <Card className={cn('w-full', className)}>
      {(title || description || headerAction) && (
        <CardHeader className="px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              {title && (
                <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
              )}
              {description && (
                <CardDescription className="text-sm">{description}</CardDescription>
              )}
            </div>
            {headerAction && (
              <div className="flex-shrink-0">{headerAction}</div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className="px-4 sm:px-6 py-4 sm:py-5">
        {children}
      </CardContent>
    </Card>
  );
}
