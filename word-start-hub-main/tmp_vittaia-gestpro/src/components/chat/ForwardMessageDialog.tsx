import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Forward, Loader2, Check, Send, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Message } from '@/types/message';
import { cn, formatMarkdownText } from '@/lib/utils';
import { toast } from 'sonner';
import { LeadAvatar } from '@/components/leads/LeadAvatar';

interface ForwardTarget {
    id: string;
    phone: string;
    displayName: string;
    photoUrl: string | null;
    isGroup: boolean;
}

interface ForwardMessageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    message: Message | null;
    currentChatId?: string;
}

export function ForwardMessageDialog({
    open,
    onOpenChange,
    message,
    currentChatId,
}: ForwardMessageDialogProps) {
    const [search, setSearch] = useState('');
    const [targets, setTargets] = useState<ForwardTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const { currentOrganization } = useOrganization();

    // Fetch available chats
    useEffect(() => {
        if (!open || !currentOrganization?.id) return;
        setSelectedIds(new Set());
        setSearch('');

        const fetchTargets = async () => {
            setLoading(true);
            const { data, error } = await (supabase as any)
                .from('chats')
                .select('id, phone, wa_name, wa_photo_url, is_group, group_name, group_photo_url, custom_name')
                .eq('organization_id', currentOrganization.id)
                .eq('hidden_from_chat', false)
                .is('resolved_at', null)
                .order('last_message_at', { ascending: false })
                .limit(100);

            if (!error && data) {
                setTargets(
                    (data as any[])
                        .filter((c: any) => c.id !== currentChatId)
                        .map((c: any) => ({
                            id: c.id,
                            phone: c.phone,
                            displayName: c.custom_name || (c.is_group ? c.group_name : c.wa_name) || c.phone,
                            photoUrl: c.is_group ? c.group_photo_url : c.wa_photo_url,
                            isGroup: c.is_group || false,
                        }))
                );
            }
            setLoading(false);
        };

        fetchTargets();
    }, [open, currentOrganization?.id, currentChatId]);

    const filteredTargets = useMemo(() => {
        if (!search.trim()) return targets;
        const lower = search.toLowerCase();
        return targets.filter(
            (t) =>
                t.displayName.toLowerCase().includes(lower) ||
                t.phone.toLowerCase().includes(lower)
        );
    }, [targets, search]);

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleForward = async () => {
        if (!message || selectedIds.size === 0 || !currentOrganization?.id) return;
        setSending(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            for (const chatId of selectedIds) {
                // Build the forwarded message content
                const forwardedContent = message.message_type === 'text'
                    ? message.content
                    : message.file_name || message.content || '';

                const insertData: any = {
                    chat_id: chatId,
                    organization_id: currentOrganization.id,
                    content: forwardedContent ? `↪ ${forwardedContent}` : '↪ Mensagem encaminhada',
                    is_from_user: true,
                    message_type: message.message_type,
                    sender_id: userId,
                    // Copy file data if applicable
                    ...(message.file_url && { file_url: message.file_url }),
                    ...(message.file_name && { file_name: message.file_name }),
                    ...(message.file_size && { file_size: message.file_size }),
                    ...(message.file_mime_type && { file_mime_type: message.file_mime_type }),
                    // Quoted preview showing it was forwarded
                    quoted_preview: {
                        text: '↪ Encaminhada',
                        label: message.content ? String(message.content).slice(0, 100) : 'Mensagem encaminhada',
                    },
                };

                await (supabase as any).from('messages').insert(insertData);

                // Update chat last_message_at
                await (supabase as any)
                    .from('chats')
                    .update({
                        last_message: forwardedContent
                            ? `↪ ${String(forwardedContent).slice(0, 100)}`
                            : '↪ Mensagem encaminhada',
                        last_message_at: new Date().toISOString(),
                    })
                    .eq('id', chatId);
            }

            toast.success(
                selectedIds.size === 1
                    ? 'Mensagem encaminhada'
                    : `Mensagem encaminhada para ${selectedIds.size} conversas`
            );
            onOpenChange(false);
        } catch (err) {
            console.error('Erro ao encaminhar:', err);
            toast.error('Erro ao encaminhar mensagem');
        } finally {
            setSending(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Preview of the message being forwarded
    const renderMessagePreview = () => {
        if (!message) return null;
        return (
            <div className="mx-4 mb-3 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
                    Encaminhando mensagem
                </p>
                <p className="text-sm text-foreground line-clamp-3">
                    {message.message_type === 'text'
                        ? message.content
                        : message.message_type === 'image'
                            ? '📷 Imagem'
                            : message.message_type === 'audio'
                                ? '🎤 Áudio'
                                : message.message_type === 'video'
                                    ? '🎥 Vídeo'
                                    : message.message_type === 'document' || message.message_type === 'pdf'
                                        ? `📄 ${message.file_name || 'Documento'}`
                                        : message.content || 'Mensagem'}
                </p>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Forward className="h-5 w-5 text-primary" />
                        Encaminhar mensagem
                    </DialogTitle>
                </DialogHeader>

                {renderMessagePreview()}

                {/* Search */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar conversa..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Target list */}
                <ScrollArea className="max-h-[300px]">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredTargets.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-8">
                            Nenhuma conversa encontrada
                        </div>
                    ) : (
                        <div className="px-2 pb-2">
                            {filteredTargets.map((target) => {
                                const isSelected = selectedIds.has(target.id);
                                return (
                                    <button
                                        key={target.id}
                                        onClick={() => toggleSelect(target.id)}
                                        className={cn(
                                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                                            isSelected
                                                ? 'bg-primary/10 border border-primary/20'
                                                : 'hover:bg-muted/50 border border-transparent'
                                        )}
                                    >
                                        <LeadAvatar
                                            isGroup={target.isGroup}
                                            photoUrl={target.photoUrl}
                                            name={target.displayName}
                                            size="sm"
                                            showGroupIndicator={target.isGroup}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{target.displayName}</p>
                                            <p className="text-xs text-muted-foreground truncate">{target.phone}</p>
                                        </div>
                                        <div
                                            className={cn(
                                                'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                                                isSelected
                                                    ? 'bg-primary border-primary'
                                                    : 'border-muted-foreground/30'
                                            )}
                                        >
                                            {isSelected && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                {/* Send button */}
                {selectedIds.size > 0 && (
                    <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            {selectedIds.size} {selectedIds.size === 1 ? 'conversa selecionada' : 'conversas selecionadas'}
                        </span>
                        <Button
                            size="sm"
                            onClick={handleForward}
                            disabled={sending}
                            className="gap-2"
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Enviar
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
