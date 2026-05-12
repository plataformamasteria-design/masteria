import React, { useEffect, useState, useRef } from 'react';
import { Zap, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';

interface SlashCommand {
  id: string;
  name: string;
  shortcut: string;
  description: string | null;
  delay_seconds: number;
  steps_count: number;
}

interface SlashCommandPickerProps {
  filter: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  visible: boolean;
}

export function SlashCommandPicker({ filter, onSelect, onClose, visible }: SlashCommandPickerProps) {
  const { currentOrganization } = useOrganization();
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentOrganization?.id && visible) {
      fetchCommands();
    }
  }, [currentOrganization?.id, visible]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const filteredCommands = getFilteredCommands();
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, selectedIndex, filter, commands]);

  const fetchCommands = async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('slash_commands')
        .select(`
          id, name, shortcut, description, delay_seconds,
          slash_command_steps(id)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('active', true)
        .order('name');

      if (error) throw error;

      const commandsWithCount = (data || []).map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        shortcut: cmd.shortcut,
        description: cmd.description,
        delay_seconds: cmd.delay_seconds ?? 5,
        steps_count: cmd.slash_command_steps?.length || 0,
      }));

      setCommands(commandsWithCount);
    } catch (error) {
      console.error('Error fetching commands:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCommands = () => {
    const normalizedFilter = filter.toLowerCase().replace(/^\//, '');
    return commands.filter(cmd =>
      cmd.shortcut.toLowerCase().includes(normalizedFilter) ||
      cmd.name.toLowerCase().includes(normalizedFilter)
    );
  };

  if (!visible) return null;

  const filteredCommands = getFilteredCommands();

  return (
    <div 
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50"
    >
      <div className="p-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4" />
          <span>Comandos Rápidos</span>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : filteredCommands.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {filter.length > 1 
            ? 'Nenhum comando encontrado'
            : 'Nenhum comando cadastrado'}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {filteredCommands.map((command, index) => (
            <button
              key={command.id}
              type="button"
              className={cn(
                'w-full flex items-start gap-3 p-3 text-left transition-colors',
                index === selectedIndex 
                  ? 'bg-primary/10' 
                  : 'hover:bg-muted/50'
              )}
              onClick={() => onSelect(command)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-primary">
                    /{command.shortcut}
                  </code>
                </div>
                <p className="text-sm font-medium text-foreground truncate">
                  {command.name}
                </p>
                {command.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {command.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {command.steps_count} {command.steps_count === 1 ? 'mensagem' : 'mensagens'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="p-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        ↑↓ navegar • Enter selecionar • Esc fechar
      </div>
    </div>
  );
}
