import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Check, X, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LeadNameEditorProps {
  chatId: string;
  customName: string | null;
  waName: string | null;
  phone: string;
  nameLocked: boolean;
  onNameUpdated: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LeadNameEditor: React.FC<LeadNameEditorProps> = ({
  chatId,
  customName,
  waName,
  phone,
  nameLocked,
  onNameUpdated,
  className,
  size = 'md',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const displayName = customName || waName || 'Sem nome';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedName(customName || waName || '');
    setIsEditing(true);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditedName('');
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!editedName.trim()) {
      toast({
        title: 'Nome inválido',
        description: 'O nome não pode estar vazio',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('chats')
        .update({
          custom_name: editedName.trim(),
          name_locked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId);

      if (error) throw error;

      toast({
        title: 'Nome atualizado',
        description: 'O nome do lead foi atualizado e travado com sucesso',
      });

      setIsEditing(false);
      onNameUpdated();
    } catch (error) {
      console.error('Error updating lead name:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o nome',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSave(e as unknown as React.MouseEvent);
    } else if (e.key === 'Escape') {
      handleCancel(e as unknown as React.MouseEvent);
    }
  };

  const sizeClasses = {
    sm: {
      input: 'h-5 text-xs py-0 px-1',
      button: 'h-4 w-4',
      icon: 'h-2.5 w-2.5',
      text: 'text-sm font-medium',
      lockIcon: 'h-2.5 w-2.5',
    },
    md: {
      input: 'h-6 text-sm py-0 px-2',
      button: 'h-5 w-5',
      icon: 'h-3 w-3',
      text: 'text-base font-semibold',
      lockIcon: 'h-3 w-3',
    },
    lg: {
      input: 'h-8 text-lg py-0 px-3',
      button: 'h-6 w-6',
      icon: 'h-4 w-4',
      text: 'text-2xl font-bold',
      lockIcon: 'h-4 w-4',
    },
  };

  const classes = sizeClasses[size];

  if (isEditing) {
    return (
      <div 
        className={cn("flex items-center gap-1", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          ref={inputRef}
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onKeyDown={handleKeyDown}
          className={classes.input}
          disabled={saving}
        />
        <Button
          variant="ghost"
          size="icon"
          className={cn(classes.button, "text-green-600 hover:text-green-700 hover:bg-green-100")}
          onClick={handleSave}
          disabled={saving}
        >
          <Check className={classes.icon} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(classes.button, "text-destructive hover:text-destructive hover:bg-destructive/10")}
          onClick={handleCancel}
          disabled={saving}
        >
          <X className={classes.icon} />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 group/name", className)}>
      <span className={cn(classes.text, "text-foreground truncate")}>
        {displayName}
      </span>
      {nameLocked && (
        <span title="Nome travado">
          <Lock className={cn(classes.lockIcon, "text-amber-500 shrink-0")} />
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className={cn(classes.button, "opacity-0 group-hover/name:opacity-100 transition-opacity text-muted-foreground hover:text-foreground")}
        onClick={handleStartEdit}
        title="Editar nome"
      >
        <Pencil className={classes.icon} />
      </Button>
    </div>
  );
};