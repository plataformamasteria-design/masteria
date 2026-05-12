import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Check, X, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LeadPhoneEditorProps {
  chatId: string;
  phone: string;
  onPhoneUpdated: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const LeadPhoneEditor: React.FC<LeadPhoneEditorProps> = ({
  chatId,
  phone,
  onPhoneUpdated,
  className,
  size = 'md',
  showIcon = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPhone, setEditedPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedPhone(phone || '');
    setIsEditing(true);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditedPhone('');
  };

  const formatPhone = (value: string): string => {
    // Remove all non-numeric characters
    return value.replace(/\D/g, '');
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const formattedPhone = formatPhone(editedPhone);
    
    if (!formattedPhone || formattedPhone.length < 8) {
      toast({
        title: 'Número inválido',
        description: 'O número de telefone deve ter pelo menos 8 dígitos',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('chats')
        .update({
          phone: formattedPhone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId);

      if (error) throw error;

      toast({
        title: 'Telefone atualizado',
        description: 'O número do lead foi atualizado com sucesso',
      });

      setIsEditing(false);
      onPhoneUpdated();
    } catch (error) {
      console.error('Error updating lead phone:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o telefone',
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
      text: 'text-xs',
      phoneIcon: 'h-3 w-3',
    },
    md: {
      input: 'h-6 text-sm py-0 px-2',
      button: 'h-5 w-5',
      icon: 'h-3 w-3',
      text: 'text-sm',
      phoneIcon: 'h-4 w-4',
    },
    lg: {
      input: 'h-8 text-base py-0 px-3',
      button: 'h-6 w-6',
      icon: 'h-4 w-4',
      text: 'text-base',
      phoneIcon: 'h-4 w-4',
    },
  };

  const classes = sizeClasses[size];

  if (isEditing) {
    return (
      <div 
        className={cn("flex items-center gap-1", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {showIcon && <Phone className={cn(classes.phoneIcon, "text-muted-foreground shrink-0")} />}
        <Input
          ref={inputRef}
          value={editedPhone}
          onChange={(e) => setEditedPhone(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(classes.input, "w-36")}
          disabled={saving}
          placeholder="Número do telefone"
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
    <div className={cn("flex items-center gap-2 group/phone", className)}>
      {showIcon && <Phone className={cn(classes.phoneIcon, "text-muted-foreground shrink-0")} />}
      <span className={cn(classes.text, "text-muted-foreground")}>
        {phone}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className={cn(classes.button, "opacity-0 group-hover/phone:opacity-100 transition-opacity text-muted-foreground hover:text-foreground")}
        onClick={handleStartEdit}
        title="Editar telefone"
      >
        <Pencil className={classes.icon} />
      </Button>
    </div>
  );
};
