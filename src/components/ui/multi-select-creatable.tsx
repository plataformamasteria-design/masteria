

'use client';

import * as React from 'react';
import { X, Check, Loader2, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput,
  CommandEmpty,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import type { ContactList, Tag } from '@/lib/types';


export interface Option {
  value: string;
  label: string;
  color?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface MultiSelectCreatableProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  placeholder?: string;
  createEndpoint: 'tags' | 'lists' | 'connections';
  createResourceType: 'tag' | 'list' | 'connection';
}

export function MultiSelectCreatable({
  selected,
  onChange,
  className,
  placeholder = 'Selecione ou crie...',
  createEndpoint,
}: MultiSelectCreatableProps): JSX.Element {
  const { toast } = useToast();
  const notify = React.useMemo(() => createToastNotifier(toast), [toast]);
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [options, setOptions] = React.useState<Option[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchOptions = React.useCallback(async () => {
    try {
        const response = await fetch(`/api/v1/${createEndpoint}`);
        if (!response.ok) throw new Error(`Falha ao carregar ${createEndpoint}.`);
        const data = await response.json();
        
        let formattedOptions: Option[] = [];
        if (createEndpoint === 'tags') {
            formattedOptions = (data.data as Tag[]).map(item => ({ value: item.id, label: item.name, color: item.color }));
        } else if (createEndpoint === 'lists') {
            formattedOptions = (data.data as ContactList[]).map(item => ({ value: item.id, label: item.name }));
        }
        
        setOptions(formattedOptions);
    } catch (error) {
        notify.error('Erro ao Carregar', (error as Error).message);
    }
  }, [createEndpoint, notify]);
  
  React.useEffect(() => {
    if (open) {
      void fetchOptions();
    }
  }, [open, fetchOptions]);

  const handleUnselect = (value: string): void => {
    onChange(selected.filter((v) => v !== value));
  };
  
  const handleCreate = async (): Promise<void> => {
    if (!inputValue.trim()) return;
    setIsLoading(true);

    try {
        const payload: { name: string; color?: string; description?: string } = { name: inputValue };
        if (createEndpoint === 'tags') {
            payload.color = '#cccccc';
        } else if (createEndpoint === 'lists') {
            payload.description = '';
        }
        
        const response = await fetch(`/api/v1/${createEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Falha ao criar nova opção.`);
        }
        
        const newOption = await response.json();
        const newFormattedOption: Option = { value: newOption.id, label: newOption.name, color: newOption.color };
        
        setOptions(prev => [...prev, newFormattedOption]);
        onChange([...selected, newOption.id]);
        setInputValue('');

        notify.success('Criado com Sucesso!', `A opção "${newOption.name}" foi criada e selecionada.`);

    } catch(error) {
        notify.error('Erro ao Criar', (error as Error).message);
    } finally {
        setIsLoading(false);
    }
  }

  const filteredOptions = options.filter(option =>
    option.label && option.label.toLowerCase().includes(inputValue.toLowerCase())
  );
  
  const showCreateOption = inputValue && !filteredOptions.some(o => o.label.toLowerCase() === inputValue.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
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
                        type="button"
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
        </div>
       </PopoverTrigger>
       <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
            <CommandInput 
                placeholder="Buscar ou criar..."
                value={inputValue}
                onValueChange={setInputValue}
            />
            <CommandList>
                <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                <CommandGroup className="h-full max-h-48 overflow-auto">
                    {filteredOptions.map((option) => (
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
                            <div className={cn('mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary', selected.includes(option.value) ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible')}>
                                <Check className={cn('h-4 w-4')} />
                            </div>
                            {option.color && <div className="h-4 w-4 rounded-full mr-2" style={{ backgroundColor: option.color }} />}
                            {option.label}
                        </CommandItem>
                    ))}
                    {showCreateOption && (
                        <CommandItem onSelect={handleCreate} disabled={isLoading}>
                             {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                             Criar &quot;{inputValue}&quot;
                        </CommandItem>
                    )}
                </CommandGroup>
            </CommandList>
            </Command>
        </PopoverContent>
    </Popover>
  );
}
