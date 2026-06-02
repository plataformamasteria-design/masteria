'use client';

import * as React from 'react';
import { X, Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export interface Option {
  value: string;
  label: string;
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (value: string[]) => void;
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between min-h-10 h-auto font-normal bg-white/[0.03] border-white/10 hover:bg-white/5 hover:text-white',
            selected.length > 0 ? 'p-2' : 'px-3 py-2 text-zinc-500',
            className
          )}
        >
          <div className="flex flex-wrap gap-1 items-center overflow-hidden">
            {selected.length > 0 ? (
              options
                .filter((option) => selected.includes(option.value))
                .map((option) => (
                  <Badge
                    variant="secondary"
                    key={option.value}
                    className="gap-1 px-2 py-0.5"
                    style={option.color ? { backgroundColor: option.color, color: '#fff' } : {}}
                  >
                    {option.icon && <option.icon className="h-3 w-3" />}
                    <span className="truncate max-w-[100px] sm:max-w-[150px]">{option.label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-black/10 p-0.5"
                      onKeyDown={(e): void => {
                        if (e.key === 'Enter') {
                          handleUnselect(option.value);
                        }
                      }}
                      onMouseDown={(e): void => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e): void => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleUnselect(option.value);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))
            ) : (
              <span className="text-zinc-500">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-zinc-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 min-w-[var(--radix-popover-trigger-width)] bg-zinc-950 border-white/10 text-white" align="start">
        <Command className="bg-transparent">
          <CommandInput placeholder="Pesquisar..." className="h-9 text-white placeholder:text-zinc-500" />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-zinc-500">Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto text-zinc-300">
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        handleUnselect(option.value);
                      } else {
                        onChange([...selected, option.value]);
                      }
                    }}
                    className="aria-selected:bg-white/10 aria-selected:text-white cursor-pointer"
                  >
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-white/20 opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <Check className={cn('h-3 w-3')} />
                    </div>
                    {option.icon && (
                      <option.icon className="mr-2 h-4 w-4 text-zinc-500" />
                    )}
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
