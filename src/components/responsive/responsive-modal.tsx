'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  fullScreenMobile?: boolean;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  fullScreenMobile = false
}: ResponsiveModalProps) {
  const { isMobile, mounted } = useResponsive();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          mounted && isMobile
            ? fullScreenMobile
              ? 'w-full h-full max-w-none max-h-none rounded-none'
              : 'w-[95%] max-w-lg'
            : 'max-w-2xl',
          className
        )}
      >
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
