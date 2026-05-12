import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Tag {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

interface ChatTagManagerProps {
  chatId: string;
  currentTags: Tag[];
  organizationId?: string;
}

export const ChatTagManager: React.FC<ChatTagManagerProps> = ({
  chatId,
  currentTags: initialTags,
  organizationId,
}) => {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [currentTags, setCurrentTags] = useState<Tag[]>(initialTags);
  const [loading, setLoading] = useState(true);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    setCurrentTags(initialTags);
  }, [initialTags]);

  useEffect(() => {
    fetchAllTags();
  }, [organizationId]);

  // Realtime subscription para atualizações de tags
  useEffect(() => {
    const channel = supabase
      .channel(`chat-tags:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_tags',
          filter: `chat_id=eq.${chatId}`,
        },
        async () => {
          // Recarregar tags quando houver mudança
          const { data: chatTags } = await supabase
            .from('chat_tags')
            .select('tag_id, tags(id, name, color, icon)')
            .eq('chat_id', chatId);

          const tags = chatTags?.map((ct: any) => ct.tags).filter(Boolean) || [];
          setCurrentTags(tags);

          // Disparar evento customizado para atualizar outras partes da UI
          window.dispatchEvent(new CustomEvent('chat-tags-updated', {
            detail: { chatId, tags }
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const fetchAllTags = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tags')
        .select('id, name, color, icon')
        .order('order_position', { ascending: true });

      // Filtrar por organização se fornecido
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAllTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    try {
      let orgId = organizationId;
      if (!orgId) {
        const { data: chatData } = await supabase.from('chats').select('organization_id').eq('id', chatId).single();
        orgId = chatData?.organization_id;
      }

      // Buscar a posição
      const { data: maxOrderData } = await supabase.from('tags').select('order_position').eq('organization_id', orgId).order('order_position', { ascending: false }).limit(1);
      const newOrder = maxOrderData?.[0]?.order_position ? maxOrderData[0].order_position + 1 : 1;

      const { data, error } = await supabase.from('tags').insert([{
        name: newTagName.trim(),
        color: newTagColor,
        organization_id: orgId,
        order_position: newOrder
      }]).select().single();

      if (error) throw error;

      fetchAllTags();
      await addTag(data.id);

      setNewTagName('');
    } catch (err) {
      console.error("error creating tag", err);
      toast({ title: 'Erro ao criar tag', variant: 'destructive' });
    } finally {
      setCreatingTag(false);
    }
  };

  const addTag = async (tagId: string) => {
    try {
      // Buscar organization_id do chat se não fornecido
      let orgId = organizationId;
      if (!orgId) {
        const { data: chatData } = await supabase
          .from('chats')
          .select('organization_id')
          .eq('id', chatId)
          .single();
        orgId = chatData?.organization_id;
      }

      const { error } = await supabase
        .from('chat_tags')
        .insert([{
          chat_id: chatId,
          tag_id: tagId,
          organization_id: orgId
        }]);

      if (error) throw error;

      supabase.functions.invoke('automation-executor', {
        body: {
          trigger_type: 'tag_added',
          chat_id: chatId,
          tag_id: tagId,
          organization_id: orgId
        }
      }).catch(e => console.error("Error triggering tag_added automation:", e));

      toast({
        title: 'Tag adicionada',
        description: 'A tag foi adicionada ao chat com sucesso.',
      });
    } catch (error) {
      console.error('Error adding tag:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar a tag.',
        variant: 'destructive',
      });
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('chat_tags')
        .delete()
        .eq('chat_id', chatId)
        .eq('tag_id', tagId);

      if (error) throw error;

      toast({
        title: 'Tag removida',
        description: 'A tag foi removida do chat com sucesso.',
      });
    } catch (error) {
      console.error('Error removing tag:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a tag.',
        variant: 'destructive',
      });
    }
  };

  const validTags = (currentTags || []).filter(t => t && t.id);

  const availableTags = allTags.filter(
    (tag) => !validTags.some((ct) => ct.id === tag.id)
  );

  return (
    <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
      {validTags.slice(0, 1).map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="gap-1 text-[10px] sm:text-xs h-6 pl-1.5 pr-2 sm:pl-2 sm:pr-2 whitespace-nowrap group relative hover:border-destructive transition-colors overflow-hidden"
          style={{
            borderColor: tag.color,
            color: tag.color,
            backgroundColor: `${tag.color}10`
          }}
        >
          {tag.name}
          <button
            onClick={(e) => { e.stopPropagation(); removeTag(tag.id); }}
            className="hidden group-hover:flex items-center justify-center absolute right-0 top-0 bottom-0 px-1 bg-destructive/90 text-destructive-foreground transition-opacity"
            title="Remover tag"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {validTags.length > 1 && (
        <Badge variant="outline" className="text-[10px] sm:text-xs h-6 px-1.5 text-muted-foreground bg-muted/50 cursor-help" title="Ver mais na aba do lead">
          +{validTags.length - 1}
        </Badge>
      )}

      {true && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1"
              disabled={loading}
            >
              <Plus className="h-3 w-3" />
              Tag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover max-h-96 w-48 overflow-y-auto z-50">
            {availableTags.map((tag) => (
              <DropdownMenuItem key={tag.id} onClick={() => addTag(tag.id)}>
                <Badge
                  variant="outline"
                  style={{
                    borderColor: tag.color,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </Badge>
              </DropdownMenuItem>
            ))}

            {navigator.maxTouchPoints <= 0 && <DropdownMenuSeparator />}

            {/* Inline Tag Creator */}
            <div className="p-2 space-y-2 mt-1" onClick={(e) => e.stopPropagation()}>
              <Input
                placeholder="Nova tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }}
                className="h-7 text-xs"
              />
              <div className="flex items-center gap-1 justify-between flex-wrap px-0.5">
                {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'].map(c => (
                  <div
                    key={c}
                    onClick={() => setNewTagColor(c)}
                    className={cn("w-4 h-4 rounded-full cursor-pointer transition-transform hover:scale-110", newTagColor === c && "ring-2 ring-primary ring-offset-1 ring-offset-background")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button size="sm" className="w-full h-6 text-xs bg-primary/10 text-primary hover:bg-primary hover:text-white" onClick={handleCreateTag} disabled={creatingTag || !newTagName.trim()}>Criar e Adicionar</Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
