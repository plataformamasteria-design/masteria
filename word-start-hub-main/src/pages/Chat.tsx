import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import PagePermissionGuard from '@/components/PagePermissionGuard';
import { useChatListPaginated, ChatWithTags } from '@/hooks/useChatListPaginated';
import { ChatList, AdvancedFilters } from '@/components/chat/ChatList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePinnedChats } from '@/hooks/usePinnedChats';
import { supabase } from '@/integrations/supabase/client';

interface Tag {
  id: string;
  name: string;
  color: string;
}

const Chat = () => {
  const [searchParams] = useSearchParams();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'mine' | 'team' | 'resolved'>('all');
  const [showOnlyGroups, setShowOnlyGroups] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    onlyUnread: false,
    awaitingResponse: false,
    robotService: false,
    botFinished: false,
    humanRequested: false,
    conversationAssignment: false,
    teamId: null,
    agentId: null,
    channel: null,
  });
  const [tags, setTags] = useState<Tag[]>([]);
  const [cachedSelectedChat, setCachedSelectedChat] = useState<ChatWithTags | null>(null);
  const isMobile = useIsMobile();
  const { currentOrganization } = useOrganization();
  const { user: currentUser } = useCurrentUser();
  const {
    chats,
    loading,
    loadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    selectedTags,
    setSelectedTags,
    refreshChats,
    loadMore,
    currentUserId,
    userTeamIds,
  } = useChatListPaginated(activeFilter, showOnlyGroups, advancedFilters, currentUser?.show_team_assigned_chats ?? false);
  const { unreadCounts, markAsRead, markAsReadOnReply } = useUnreadMessages();
  const { pinnedChatIds, togglePin, isPinned, pinnedCount, pinChat, unpinChat } = usePinnedChats(activeFilter, userTeamIds);

  // Fetch tags
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const fetchTags = async () => {
      const { data } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('organization_id', currentOrganization.id)
        .order('order_position', { ascending: true });
      setTags(data || []);
    };

    fetchTags();
  }, [currentOrganization?.id]);

  // Auto-select chat from URL parameter
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('id');
    if (chatIdFromUrl && chats.length > 0) {
      const chatExists = chats.find(chat => chat.id === chatIdFromUrl);
      if (chatExists) {
        setSelectedChatId(chatIdFromUrl);
        markAsRead(chatIdFromUrl);
      }
    }
  }, [searchParams, chats]);

  // Manter cache do chat selecionado para evitar flicker
  useEffect(() => {
    if (selectedChatId) {
      const foundChat = chats.find((chat) => chat.id === selectedChatId);
      if (foundChat) {
        setCachedSelectedChat(foundChat);
      }
    } else {
      setCachedSelectedChat(null);
    }
  }, [chats, selectedChatId]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    markAsRead(chatId);
  };

  const handleBackToList = () => {
    setSelectedChatId(null);
  };

  // Usar cachedSelectedChat para manter a área de chat visível durante reloads
  const selectedChat = cachedSelectedChat;

  const showChatList = !isMobile || !selectedChatId;
  const showChatWindow = !isMobile || selectedChatId;

  return (
    <AppShell noPadding>
      <PagePermissionGuard page="chat">
        <div className="flex h-full w-full overflow-hidden">
          {showChatList && (
            <div className={`
              ${isMobile ? 'w-full' : 'w-[32%] min-w-[300px] max-w-[420px]'}
              h-full overflow-hidden border-r
            `}>
              <ChatList
                chats={chats}
                selectedChatId={selectedChatId}
                onSelectChat={handleSelectChat}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedTags={selectedTags}
                onSelectedTagsChange={setSelectedTags}
                tags={tags}
                loading={loading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                onLoadMore={loadMore}
                refreshChats={refreshChats}
                unreadCounts={unreadCounts}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                showOnlyGroups={showOnlyGroups}
                onShowOnlyGroupsChange={setShowOnlyGroups}
                advancedFilters={advancedFilters}
                onAdvancedFiltersChange={setAdvancedFilters}
                currentUserId={currentUserId}
                userTeamIds={userTeamIds}
                pinnedChatIds={pinnedChatIds}
                isPinned={isPinned}
                pinChat={pinChat}
                unpinChat={unpinChat}
              />
            </div>
          )}

          {showChatWindow && (
            <div className={`${isMobile ? 'w-full' : 'flex-1'} h-full overflow-hidden`}>
              <ChatWindow
                chat={selectedChat}
                onBack={isMobile ? handleBackToList : undefined}
                onMessageSent={() => {
                  if (selectedChatId) {
                    markAsReadOnReply(selectedChatId);
                  }
                }}
              />
            </div>
          )}
        </div>
      </PagePermissionGuard>
    </AppShell>
  );
};

export default Chat;