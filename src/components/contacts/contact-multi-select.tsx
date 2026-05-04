// src/components/contacts/contact-multi-select.tsx
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
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';


export interface Option {
  value: string;
  label: string;
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface ContactMultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (value: string[]) => void;
  className?: string;
  placeholder?: string;
}

export function ContactMultiSelect({
  options,
  selected,
  onChange,
  className,
  placeholder = 'Selecione...',
}: ContactMultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleUnselect = (item: string) => {
    onChange(selected.filter((i) => i !== item));
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
            type="button"
            className={cn("flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)}
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
                        className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleUnselect(option.value);
                        }
                        }}
                        onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        }}
                        onClick={() => handleUnselect(option.value)}
                    >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                    </Badge>
                ))
            ) : (
                <span className="text-muted-foreground">{placeholder}</span>
            )}
            </div>
        </button>
       </PopoverTrigger>
       <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
            <CommandList>
                <CommandGroup className="h-full overflow-auto">
                {options.map((option) => (
                    <CommandItem
                    key={option.value}
                    onSelect={() => {
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
        </PopoverContent>
    </Popover>
  );
}
