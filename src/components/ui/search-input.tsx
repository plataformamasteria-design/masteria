'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  showLoading?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  debounceMs = 300,
  className,
  showLoading = false,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    if (internalValue === value) {
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);
    const timer = setTimeout(() => {
      onChange(internalValue);
      setIsDebouncing(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [internalValue, debounceMs, onChange, value]);

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChange('');
  }, [onChange]);

  const showLoadingIndicator = showLoading && isDebouncing;

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
        aria-label={placeholder}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
        {showLoadingIndicator ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : internalValue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-6 w-6"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
