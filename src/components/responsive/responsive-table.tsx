'use client';

import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ResponsiveTableProps<T> {
  data: T[];
  columns: {
    header: string;
    accessor: keyof T | ((item: T) => ReactNode);
    className?: string;
    mobileHide?: boolean;
  }[];
  mobileCard?: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function ResponsiveTable<T extends { id: string | number }>({
  data,
  columns,
  mobileCard,
  onRowClick,
  loading,
  emptyMessage = 'Nenhum dado encontrado'
}: ResponsiveTableProps<T>) {
  const { isMobile, mounted } = useResponsive();

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  if (mounted && isMobile && mobileCard) {
    return (
      <div className="space-y-3">
        {data.map((item) => (
          <div
            key={item.id}
            onClick={() => onRowClick?.(item)}
            className={cn(
              'rounded-lg border bg-card p-4',
              onRowClick && 'cursor-pointer hover:bg-accent transition-colors'
            )}
          >
            {mobileCard(item)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((column, idx) => (
              <th
                key={idx}
                className={cn(
                  'h-12 px-4 text-left align-middle font-medium text-muted-foreground',
                  column.mobileHide && 'hidden sm:table-cell',
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={cn(
                'border-b transition-colors',
                onRowClick && 'cursor-pointer hover:bg-muted/50'
              )}
            >
              {columns.map((column, idx) => (
                <td
                  key={idx}
                  className={cn(
                    'p-4 align-middle',
                    column.mobileHide && 'hidden sm:table-cell',
                    column.className
                  )}
                >
                  {typeof column.accessor === 'function'
                    ? column.accessor(item)
                    : String(item[column.accessor])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
