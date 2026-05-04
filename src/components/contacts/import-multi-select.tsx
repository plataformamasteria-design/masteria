// src/components/contacts/import-multi-select.tsx
'use client'

import * as React from 'react';
import { createToastNotifier } from '@/lib/toast-helper';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tag, ContactList } from '@/lib/types';
import { Label } from '../ui/label';


type Option = {
    value: string;
    label: string;
    color?: string;
}

interface ImportMultiSelectProps {
    type: 'tags' | 'lists';
    selectedIds: string[];
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function ImportMultiSelect({ type, selectedIds, setSelectedIds }: ImportMultiSelectProps): React.JSX.Element {
    const [options, setOptions] = React.useState<Option[]>([]);
    const [open, setOpen] = React.useState(false);
    const { toast } = useToast();
    const notify = React.useMemo(() => createToastNotifier(toast), [toast]);

    React.useEffect(() => {
        const fetchOptions = async (): Promise<void> => {
            try {
                const response = await fetch(`/api/v1/${type}`);
                if (!response.ok) throw new Error(`Falha ao carregar ${type}.`);
                const data: (Tag | ContactList)[] = await response.json();
                setOptions(data.map(item => ({ value: item.id, label: item.name, color: (item as Tag).color })));
            } catch (error) {
                notify.error(`Erro ao carregar ${type}`, (error as Error).message);
            }
        };

        if (open) {
            void fetchOptions();
        }
    }, [open, type, notify]);

    const handleUnselect = (value: string): void => {
        setSelectedIds(selectedIds.filter((v) => v !== value));
    };

    const label = type === 'tags' ? 'Adicionar Tags aos Contatos' : 'Adicionar Contatos às Listas';
    const placeholder = type === 'tags' ? 'Selecione tags...' : 'Selecione listas...';

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn("flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50")}
                >
                    <div className="flex flex-wrap gap-1">
                    {selectedIds.length > 0 ? (
                        options
                        .filter((option) => selectedIds.includes(option.value))
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
                                onKeyDown={(e): void => { if (e.key === 'Enter') handleUnselect(option.value); }}
                                onMouseDown={(e): void => { e.preventDefault(); e.stopPropagation(); }}
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
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Buscar ${type}...`} />
                    <CommandList>
                        <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
                        <CommandGroup className="h-full max-h-48 overflow-auto">
                        {options.map((option) => (
                            <CommandItem
                                key={option.value}
                                onSelect={(): void => {
                                    setSelectedIds(
                                    selectedIds.includes(option.value)
                                        ? selectedIds.filter((item) => item !== option.value)
                                        : [...selectedIds, option.value]
                                    );
                                }}
                            >
                                <div className={cn('mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary', selectedIds.includes(option.value) ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible')}>
                                    <Check className={cn('h-4 w-4')} />
                                </div>
                                {option.color && <div className="h-4 w-4 rounded-full mr-2" style={{ backgroundColor: option.color }} />}
                                {option.label}
                            </CommandItem>
                        ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
            </Popover>
        </div>
    )
}
