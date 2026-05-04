
'use client';

import * as React from 'react';
import { X, Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface Option {
  value: string;
  label: string;
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  className?: string;
  placeholder?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  className,
  placeholder = 'Selecione...',
}: MultiSelectProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const handleUnselect = (item: string): void => {
    onChange(selected.filter((i) => i !== item));
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className={cn('relative', className)}>
      <div
        onClick={(): void => setOpen(true)}
        className="flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex flex-wrap gap-1">
          {selected.length > 0 ? (
            options
              .filter((option) => selected.includes(option.value))
              .map((option) => (
                <Badge
                  variant="secondary"
                  key={option.value}
                  className="gap-1.5"
                  style={option.color ? { backgroundColor: option.color, color: '#fff' } : {}}
                >
                  {option.label}
                  <button
                    type="button"
                    className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onKeyDown={(e): void => {
                      if (e.key === 'Enter') {
                        handleUnselect(option.value);
                      }
                    }}
                    onMouseDown={(e): void => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(): void => handleUnselect(option.value)}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </Badge>
              ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
      </div>

      {open && (
        <Command
          className="absolute top-full z-10 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in"
        >
          <CommandList>
            <CommandGroup className="h-full overflow-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={(): void => {
                    onChange(
                      selected.includes(option.value)
                        ? selected.filter((item) => item !== option.value)
                        : [...selected, option.value]
                    );
                  }}
                >
                  <div
                    className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                      selected.includes(option.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'opacity-50 [&_svg]:invisible'
                    )}
                  >
                    <Check className={cn('h-4 w-4')} />
                  </div>
                  {option.icon && (
                    <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  )}
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}
    </div>
  );
}
