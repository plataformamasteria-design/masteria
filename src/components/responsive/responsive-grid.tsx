import { cn } from '@/lib/utils';

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
  gap?: 'sm' | 'md' | 'lg' | 'xl';
}

const gapClasses = {
  sm: 'gap-2 sm:gap-3',
  md: 'gap-3 sm:gap-4 lg:gap-6',
  lg: 'gap-4 sm:gap-6 lg:gap-8',
  xl: 'gap-6 sm:gap-8 lg:gap-10',
};

export function ResponsiveGrid({ 
  children, 
  className,
  cols = { xs: 1, sm: 2, md: 3, lg: 4 },
  gap = 'md'
}: ResponsiveGridProps) {
  const gridCols = cn(
    'grid',
    cols.xs && `grid-cols-${cols.xs}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
    cols['2xl'] && `2xl:grid-cols-${cols['2xl']}`,
    gapClasses[gap],
    className
  );

  return (
    <div className={gridCols}>
      {children}
    </div>
  );
}
