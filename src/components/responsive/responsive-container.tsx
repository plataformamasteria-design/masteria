import { cn } from '@/lib/utils';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  '3xl': 'max-w-[1920px]',
  full: 'max-w-full',
};

export function ResponsiveContainer({ 
  children, 
  className,
  maxWidth = '3xl' 
}: ResponsiveContainerProps) {
  return (
    <div className={cn(
      'w-full mx-auto',
      'px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-24',
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  );
}
