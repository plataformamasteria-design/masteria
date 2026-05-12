import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type LeadOption = {
  id: string;
  label: string;
  subtitle?: string;
  value: string; // remoteJid/phone
};

interface LeadMultiSelectProps {
  items: LeadOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function LeadMultiSelect({
  items,
  value,
  onChange,
  placeholder = "Selecionar leads...",
  disabled,
}: LeadMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    const set = new Set(value);
    return items.filter((i) => set.has(i.id));
  }, [items, value]);

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate">
              {selected.length ? `${selected.length} selecionado(s)` : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar lead..." />
            <CommandList>
              <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => {
                  const isSelected = value.includes(item.id);
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.subtitle || ""}`}
                      onSelect={() => toggle(item.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="min-w-0">
                        <div className="truncate">{item.label}</div>
                        {item.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.slice(0, 6).map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1">
              <span className="max-w-[180px] truncate">{s.label}</span>
              <button
                type="button"
                className="rounded hover:bg-background/30"
                onClick={() => toggle(s.id)}
                aria-label="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selected.length > 6 && (
            <Badge variant="outline">+{selected.length - 6}</Badge>
          )}
        </div>
      )}
    </div>
  );
}
