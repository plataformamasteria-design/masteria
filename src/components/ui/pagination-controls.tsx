'use client';

import { useEffect, useRef } from 'react';
import { Button } from './button';
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationControlsProps {
  totalItems: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationControls({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  className,
}: PaginationControlsProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        e.preventDefault();
        onPageChange(currentPage - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        e.preventDefault();
        onPageChange(currentPage + 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        onPageChange(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        onPageChange(totalPages);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, onPageChange]);

  useEffect(() => {
    if (liveRegionRef.current) {
      const startItem = (currentPage - 1) * pageSize + 1;
      const endItem = Math.min(currentPage * pageSize, totalItems);
      liveRegionRef.current.textContent = `Página ${currentPage} de ${totalPages}. Mostrando ${startItem} a ${endItem} de ${totalItems} itens.`;
    }
  }, [currentPage, totalPages, pageSize, totalItems]);

  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <>
      <div
        ref={liveRegionRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />
      <div
        className={cn(
          'flex items-center justify-center gap-1 sm:gap-2',
          className
        )}
        role="navigation"
        aria-label="Paginação"
      >
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        aria-label="Primeira página"
        className="h-8 w-8 sm:h-9 sm:w-9"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Página anterior"
        className="h-8 w-8 sm:h-9 sm:w-9"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="hidden sm:flex items-center gap-1">
        {pageNumbers.map((page, index) =>
          typeof page === 'number' ? (
            <Button
              key={index}
              variant={currentPage === page ? 'default' : 'outline'}
              size="icon"
              onClick={() => onPageChange(page)}
              aria-label={`Página ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
              className="h-9 w-9"
            >
              {page}
            </Button>
          ) : (
            <span
              key={index}
              className="px-2 text-muted-foreground"
              aria-hidden="true"
            >
              {page}
            </span>
          )
        )}
      </div>

      <div className="flex sm:hidden items-center px-2 text-sm font-medium">
        <span>
          {currentPage} / {totalPages}
        </span>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Próxima página"
        className="h-8 w-8 sm:h-9 sm:w-9"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        aria-label="Última página"
        className="h-8 w-8 sm:h-9 sm:w-9"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
      </div>
    </>
  );
}
