'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full',
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = 'md'
}: ResponsiveDialogProps) {
  const { isMobile, mounted } = useResponsive();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          mounted && isMobile ? 'w-[95%] max-h-[90vh] overflow-y-auto' : sizeClasses[size],
          'p-4 sm:p-6',
          className
        )}
      >
        {(title || description) && (
          <DialogHeader className="space-y-2 sm:space-y-3">
            {title && (
              <DialogTitle className="text-lg sm:text-xl">{title}</DialogTitle>
            )}
            {description && (
              <DialogDescription className="text-sm">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}
        <div className="py-2 sm:py-4">{children}</div>
        {footer && (
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
