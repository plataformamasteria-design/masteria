import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { conversationService, type AdvancedFilters } from '@/services/api/conversations-service';
import { contactsService } from '@/services/api/contacts-service';
// Import Server Actions
import { sendMessageAction, toggleAiAction, archiveConversationAction, unarchiveConversationAction, fetchAvailableConnections, switchConnectionAction, syncBaileysHistoryAction } from '@/app/actions/chat';
import type { Conversation, Message, Contact } from '@/lib/types';
import { useSession } from '@/contexts/session-context';
import { useInboxWebSocket } from './use-inbox-websocket';
import type { InboxEventCallback } from './use-inbox-websocket';



interface UseInboxControllerProps {
    preselectedConversationId?: string;
    initialConversations?: Conversation[];
    initialTemplates?: any[];
}

export function useInboxController({
    preselectedConversationId,
    initialConversations = [],
    initialTemplates = []
}: UseInboxControllerProps) {

    const router = useRouter();
    const { toast } = useToast();
    const { session } = useSession();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    // Data State
    const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
    const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [templates, setTemplates] = useState<any[]>(initialTemplates);
    const [availableConnections, setAvailableConnections] = useState<any[]>([]);


    // UI State
    const [initialLoading, setInitialLoading] = useState(initialConversations.length === 0);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [showContactDetails, setShowContactDetails] = useState(false);

    // Pagination State
    const [conversationsOffset, setConversationsOffset] = useState(0);
    const [hasMoreConversations, setHasMoreConversations] = useState(true);
    const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'mine' | 'team' | 'resolved'>('all');
    const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
        onlyUnread: false,
        awaitingResponse: false,
        robotService: false,
        filterTeamId: null,
        filterAgentId: null,
        filterTagId: null,
        filterKanbanId: null,
    });

    // Message Pagination
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);

    // Polling State
    const [lastKnownUpdate, setLastKnownUpdate] = useState<string | null>(null);

    // --- Actions ---

    const fetchConversations = useCallback(async (offset = 0, append = false, search = '', filterParam = activeFilter, advFilters = advancedFilters, bypassCache = false) => {
        try {
            const data = await conversationService.list(offset, 50, search, filterParam, advFilters, bypassCache);

            setConversations(prev => append ? [...prev, ...data] : data);
            setHasMoreConversations(data.length === 50);
            return data;
        } catch (error) {
            notify.error('Erro', (error as Error).message);
            return [];
        }
    }, [notify, advancedFilters]);

    const loadMoreConversations = useCallback(async () => {
        if (isLoadingMoreConversations || !hasMoreConversations) return;
        setIsLoadingMoreConversations(true);
        const newOffset = conversationsOffset + 50;
        try {
            await fetchConversations(newOffset, true, searchTerm, activeFilter);
            setConversationsOffset(newOffset);
        } finally {
            setIsLoadingMoreConversations(false);
        }
    }, [conversationsOffset, fetchConversations, hasMoreConversations, isLoadingMoreConversations, searchTerm, activeFilter]);

    const handleSearchChange = useCallback(async (term: string) => {
        setSearchTerm(term);
        setConversationsOffset(0);
        setIsSearching(true);
        try {
            await fetchConversations(0, false, term, activeFilter);
        } finally {
            setIsSearching(false);
        }
    }, [fetchConversations, activeFilter]);

    const handleFilterChange = useCallback(async (filter: 'all' | 'mine' | 'team' | 'resolved') => {
        setActiveFilter(filter);
        setConversationsOffset(0);
        setIsSearching(true);
        try {
            await fetchConversations(0, false, searchTerm, filter, advancedFilters);
        } finally {
            setIsSearching(false);
        }
    }, [fetchConversations, searchTerm, advancedFilters]);

    const handleAdvancedFiltersChange = useCallback(async (newFilters: AdvancedFilters) => {
        setAdvancedFilters(newFilters);
        setConversationsOffset(0);
        setIsSearching(true);
        try {
            await fetchConversations(0, false, searchTerm, activeFilter, newFilters);
        } finally {
            setIsSearching(false);
        }
    }, [fetchConversations, searchTerm, activeFilter]);

    const fetchContactDetails = useCallback(async (contactId: string) => {
        try {
            const data = await contactsService.get(contactId);
            setSelectedContact(data);
        } catch (error) {
            console.error("Failed to fetch contact", error);
        }
    }, []);

    const fetchAndSetMessages = useCallback(async (conversationId: string, before?: string, prepend = false, silent = false, bypassCache = false) => {
        if (!prepend && !silent) setLoadingMessages(true);
        try {
            const result = await conversationService.getMessages(conversationId, 16, before, bypassCache);

            setCurrentMessages(prev => {
                // ✅ FIX: Merge inteligente UNIVERSAL para evitar duplicatas do prepend(scroll) e Polling.
                const messageMap = new Map<string, Message>();

                // Primeiro, adicionar mensagens existentes (inclui otimistas)
                prev.forEach(m => messageMap.set(m.id, m));

                // Depois, sobrescrever/adicionar com mensagens do servidor
                result.messages.forEach(m => messageMap.set(m.id, m));

                // Ordenar cronologicamente
                return Array.from(messageMap.values())
                    .sort((a, b) => new Date(a.sentAt!).getTime() - new Date(b.sentAt!).getTime());
            });
            setHasMoreMessages(result.hasMore);
        } catch (error) {
            if (!silent) notify.error('Erro', (error as Error).message);
        } finally {
            if (!prepend && !silent) setLoadingMessages(false);
        }
    }, [notify]);

    const handleSelectConversation = useCallback(async (conversationId: string) => {
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) return;

        setSelectedConversation(conversation);
        setCurrentMessages([]); // clear old
        setSelectedContact(null);
        setHasMoreMessages(true);

        await Promise.all([
            fetchAndSetMessages(conversationId),
            fetchContactDetails(conversation.contactId)
        ]);

        // Update URL without refresh
        router.push(`/atendimentos?conversationId=${conversationId}`, { scroll: false });
    }, [conversations, fetchAndSetMessages, fetchContactDetails, router]);

    const handleSendMessage = useCallback(async (text: string) => {
        if (!selectedConversation || !session?.userId) return;

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
            id: tempId,
            conversationId: selectedConversation.id,
            senderType: 'AGENT',
            senderId: session.userId,
            content: text,
            contentType: 'TEXT',
            status: 'PENDING',
            sentAt: new Date(),
            providerMessageId: null,
            repliedToMessageId: null,
            mediaUrl: null,
            readAt: null
        } as Message;

        setCurrentMessages(prev => [...prev, optimisticMessage]);

        try {
            const result = await sendMessageAction(selectedConversation.id, text);
            if (!result.success) throw new Error(result.error);

            // Replace temp id with real DB id so polling merge won't duplicate
            setCurrentMessages(prev => prev.map(m =>
                m.id === tempId
                    ? { ...m, id: result.dbId || m.id, status: 'SENT', providerMessageId: result.messageId } as Message
                    : m
            ));
        } catch (error) {
            notify.error('Erro de Envio', (error as Error).message);
            setCurrentMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'FAILED' } as Message : m));
        }
    }, [selectedConversation, session, notify]);

    const handleSendMedia = useCallback(async (file: File, caption?: string) => {
        if (!selectedConversation || !session?.userId) return;

        const tempId = `temp-media-${Date.now()}`;
        let contentType: any = 'DOCUMENT';
        if (file.type.startsWith('image/')) contentType = 'IMAGE';
        else if (file.type.startsWith('video/')) contentType = 'VIDEO';
        else if (file.type.startsWith('audio/')) contentType = 'AUDIO';

        const optimisticMessage: Message = {
            id: tempId,
            conversationId: selectedConversation.id,
            senderType: 'AGENT',
            senderId: session.userId,
            content: caption || file.name,
            contentType,
            status: 'PENDING',
            sentAt: new Date(),
            providerMessageId: null,
            repliedToMessageId: null,
            mediaUrl: URL.createObjectURL(file), // Temp URL
            readAt: null
        } as Message;

        setCurrentMessages(prev => [...prev, optimisticMessage]);

        try {
            const formData = new FormData();
            formData.append('file', file);
            if (caption) {
                formData.append('caption', caption);
            }
            
            const res = await fetch(`/api/v1/conversations/${selectedConversation.id}/media`, {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            
            if (!res.ok) throw new Error(result.error || 'Erro ao enviar mídia');

            setCurrentMessages(prev => prev.map(m =>
                m.id === tempId
                    ? { ...m, id: result.id || m.id, status: 'SENT', providerMessageId: result.providerMessageId, mediaUrl: result.mediaUrl } as Message
                    : m
            ));
        } catch (error) {
            notify.error('Erro de Envio', (error as Error).message);
            setCurrentMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'FAILED' } as Message : m));
        }
    }, [selectedConversation, session, notify]);

    const handleToggleAi = useCallback(async (conversationId: string, aiActive: boolean) => {
        // Optimistic
        setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, aiActive } : c));
        if (selectedConversation?.id === conversationId) {
            setSelectedConversation(prev => prev ? { ...prev, aiActive } : null);
        }

        try {
            const result = await toggleAiAction(conversationId, aiActive);
            if (!result.success) throw new Error(result.error);

            notify.success('IA Atualizada', `IA ${aiActive ? 'ativada' : 'desativada'}.`);
        } catch (error) {
            notify.error('Erro ao alternar IA', (error as Error).message);
            // Revert
            setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, aiActive: !aiActive } : c));
        }
    }, [notify, selectedConversation]);

    const handleSwitchConnection = useCallback(async (connectionId: string) => {
        if (!selectedConversation) return;

        try {
            const result = await switchConnectionAction(selectedConversation.id, connectionId);
            if (!result.success) throw new Error(result.error);

            // Update local state strictly
            const updatedConv: Conversation = {
                ...selectedConversation,
                connectionId,
                connectionType: result.connectionType as any,
                connectionName: result.connectionName
            };
            setSelectedConversation(updatedConv);
            setConversations(prev => prev.map(c =>
                c.id === selectedConversation.id
                    ? { ...c, connectionId, connectionType: result.connectionType, connectionName: result.connectionName } as Conversation
                    : c
            ));

            const label = result.connectionType === 'baileys' ? 'Baileys (Gratuito)' : 'API Oficial';
            notify.success('Conexão Alterada', `Usando: ${label}`);
        } catch (error) {
            notify.error('Erro', (error as Error).message);
        }
    }, [selectedConversation, notify]);

    const handleSyncHistory = useCallback(async () => {
        if (!selectedConversation || (selectedConversation as any)?.connectionType !== 'baileys') return;

        try {
            notify.info('Sincronização Iniciada', 'Solicitando histórico ao WhatsApp. Pode levar alguns segundos.');
            const result = await syncBaileysHistoryAction(selectedConversation.id);
            if (!result.success) throw new Error(result.error);
            notify.success('Sucesso', 'Mensagens sincronizadas. Elas aparecerão automaticamente.');
        } catch (error) {
            notify.error('Erro', (error as Error).message);
        }
    }, [selectedConversation, notify]);

    // Initialization Logic
    useEffect(() => {
        const init = async () => {
            // Only fetch if we didn't receive initial data (e.g. direct client navigation without server props, though page.tsx handles it)
            // But usually Next.js preserves state. 
            // We still need to handle preselectedConversation if it wasn't resolved during hydration.

            if (initialConversations.length === 0) {
                // Fallback for full client fetch if no server data
                const [_data, templatesData] = await Promise.all([
                    fetchConversations(),
                    fetch('/api/v1/message-templates').then(r => r.json()).catch(() => ({ templates: [] }))
                ]);
                setTemplates(templatesData.templates || templatesData || []);
            }

            // Fetch available connections
            const conns = await fetchAvailableConnections();
            setAvailableConnections(conns);

            if (preselectedConversationId) {
                // Find in existing (server passed) or just fetched
                const target = (initialConversations.length > 0 ? initialConversations : conversations).find(c => c.id === preselectedConversationId);

                if (target) {
                    setSelectedConversation(target);
                    // Fetch details for the selected one
                    await Promise.all([
                        fetchAndSetMessages(target.id),
                        fetchContactDetails(target.contactId)
                    ]);
                }
            }
            setInitialLoading(false);
        };
        init();
    }, []); // Run once

    // WebSocket + SSE Realtime Logic
    // Controla suppressão do slow-path após fast-path (evita reset da lista)
    const fastPathConvIds = useRef<Map<string, number>>(new Map());

    const handleRealtimeEvent: InboxEventCallback = useCallback(async (event: string, payload?: any) => {

        // ━━━ FAST PATH: chat:new-message com payload completo ━━━━━━━━━━━━━━━━━━━━━━━
        // Append direto — zero latência, sem refetch de toda a lista
        if (event === 'chat:new-message' && payload?.conversationId) {
            const {
                conversationId,
                messageId,
                content,
                contentType,
                isFromMe,
                mediaUrl,
                timestamp,
                contactName,
            } = payload;

            // 1. Mover a conversa para o topo da lista e atualizar lastMessage
            setConversations(prev => {
                const idx = prev.findIndex(c => c.id === conversationId);
                if (idx === -1) {
                    // Conversa desconhecida (pode ser nova) — disparar full refresh
                    fetchConversations(0, false, searchTerm, activeFilter, advancedFilters, true)
                        .catch(e => console.error('[InboxController] Error on new conversation refresh:', e));
                    return prev;
                }
                // Determinar senderType correto para exibir na lista
                const effectiveSenderType = payload.senderType
                    || (isFromMe ? 'AGENT' : 'CONTACT');
                const updated = {
                    ...prev[idx],
                    lastMessage: content || '',
                    lastMessageAt: new Date(timestamp || Date.now()),
                    lastMessageSenderType: effectiveSenderType,
                };
                // Move para o topo
                return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
            });

            // 2. Append direto na conversa ativa (se for a que está aberta)
            if (selectedConversation?.id === conversationId) {
                // Determinar senderType real:
                // - Usar o campo 'senderType' do payload se presente (Baileys pode enviar 'AI', 'BOT', etc.)
                // - Fallback: isFromMe = true → 'AGENT', false → 'CONTACT'
                const resolvedSenderType: Message['senderType'] = (
                    payload.senderType as Message['senderType']
                ) || (isFromMe ? 'AGENT' : 'CONTACT');

                const newMsg: Message = {
                    id: messageId || `ws-${Date.now()}`,
                    conversationId,
                    senderType: resolvedSenderType,
                    senderId: null,
                    content: content || '',
                    contentType: (contentType?.toUpperCase() as any) || 'TEXT',
                    status: isFromMe ? 'SENT' : 'DELIVERED',
                    sentAt: new Date(timestamp || Date.now()),
                    providerMessageId: null,
                    repliedToMessageId: null,
                    mediaUrl: mediaUrl || null,
                    readAt: null,
                } as Message;

                setCurrentMessages(prev => {
                    // Evitar duplicatas pelo messageId
                    if (newMsg.id && prev.some(m => m.id === newMsg.id)) return prev;
                    // Append + ordenar por sentAt para garantir ordem cronológica
                    return [...prev, newMsg].sort(
                        (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
                    );
                });
            }

            // Marcar esta conversa como "fast-path ativo" por 2s
            // O inbox:update slow-path vai ignorar essa conversa nesse período
            fastPathConvIds.current.set(conversationId, Date.now());

            return; // Fast path concluído
        }

        // ━━━ FAST PATH: chat:message-updated (URL de mídia disponível) ━━━━━━━━━━━
        if (event === 'chat:message-updated' && payload?.messageId) {
            setCurrentMessages(prev => prev.map(m =>
                m.id === payload.messageId
                    ? { ...m, mediaUrl: payload.mediaUrl }
                    : m
            ));
            return;
        }

        // ━━━ SLOW PATH: inbox:update — full refresh da lista e mensagens ━━━━━━━━━
        try {
            const _updatedList = await fetchConversations(0, false, searchTerm, activeFilter, advancedFilters, true);

            if (selectedConversation) {
                const freshConvo = _updatedList.find(c => c.id === selectedConversation.id);
                if (freshConvo) setSelectedConversation(freshConvo);

                // Só fazer refetch de mensagens se não houve fast-path recente (<2s)
                // para evitar que o slow-path sobrescreva/desordene mensagens já appendadas
                const lastFastPath = fastPathConvIds.current.get(selectedConversation.id);
                const isRecentFastPath = lastFastPath && (Date.now() - lastFastPath) < 2000;

                if (!isRecentFastPath) {
                    await fetchAndSetMessages(selectedConversation.id, undefined, false, true, true);
                } else {
                    console.log('[InboxController] Slow-path suprimido (fast-path recente)');
                }
            }
        } catch (e) {
            console.error('[InboxController] WebSocket/SSE refresh error:', e);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchConversations, fetchAndSetMessages, selectedConversation, searchTerm, activeFilter, advancedFilters]);

    useInboxWebSocket(handleRealtimeEvent);

    return {
        // State
        conversations,
        currentMessages,
        selectedConversation,
        selectedContact,
        templates, // Returned here
        initialLoading,
        loadingMessages,
        showContactDetails,
        setShowContactDetails,
        searchTerm,
        isSearching,
        activeFilter,
        hasMoreConversations,
        isLoadingMoreConversations,
        hasMoreMessages,
        isLoadingMoreMessages,

        // Actions
        loadMoreConversations,
        handleSearchChange,
        handleFilterChange,
        handleAdvancedFiltersChange,
        advancedFilters,
        handleSelectConversation,
        handleSendMessage,
        handleSendMedia,
        handleToggleAi,
        handleSwitchConnection,
        handleSyncHistory,
        availableConnections,
        loadMoreMessages: async () => {
            if (isLoadingMoreMessages || !hasMoreMessages || !currentMessages[0]) return;
            setIsLoadingMoreMessages(true);
            const oldestTime = currentMessages[0].sentAt instanceof Date
                ? currentMessages[0].sentAt.toISOString()
                : new Date(currentMessages[0].sentAt!).toISOString();
            await fetchAndSetMessages(selectedConversation!.id, oldestTime, true);
            setIsLoadingMoreMessages(false);
        },
        // Missing actions like Archive can be added here
        handleArchive: async () => {
            if (!selectedConversation) return;
            const result = await archiveConversationAction(selectedConversation.id);
            if (result.success) {
                notify.success('Conversa Arquivada');
                setSelectedConversation(null);
                // Refresh list or remove locally
                setConversations(prev => prev.filter(c => c.id !== selectedConversation.id));
            } else {
                notify.error('Erro', result.error || 'Erro ao arquivar');
            }
        },
        handleUnarchive: async () => {
            if (!selectedConversation) return;
            const result = await unarchiveConversationAction(selectedConversation.id);
            if (result.success) {
                notify.success('Conversa Reaberta');
                fetchConversations();
            } else {
                notify.error('Erro', result.error || 'Erro ao reabrir');
            }
        }
    };
}
