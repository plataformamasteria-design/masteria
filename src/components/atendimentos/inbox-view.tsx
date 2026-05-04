'use client';

import { Loader2, MessagesSquare, X } from 'lucide-react';
import { ConversationList } from './conversation-list';
import { ActiveChat } from './active-chat';
import { ContactDetailsPanel } from './contact-details-panel';
import { Skeleton } from '../ui/skeleton';
import { useInboxController } from '@/hooks/use-inbox-controller';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

// Import Type
import { Conversation } from '@/lib/types';

const InboxSkeleton = () => (
  <div className="h-full flex flex-row rounded-2xl overflow-hidden border border-white/[0.06] bg-card/30">
    <div className="w-full md:w-[310px] lg:w-[290px] xl:w-[310px] flex-shrink-0 h-full border-r border-white/[0.06] p-3 space-y-2 hidden md:flex md:flex-col">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3 p-3">
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4 rounded-lg" />
            <Skeleton className="h-3 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
    <div className="h-full flex md:hidden items-center justify-center p-4">
      <div className="w-full space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
    <div className="flex-1 min-w-0 hidden md:flex items-center justify-center border-r border-white/[0.06]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
    </div>
  </div>
)

const NoConversationSelected = () => (
  <div className="h-full hidden md:flex flex-col items-center justify-center text-center p-8">
    <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-5">
      <MessagesSquare className="h-8 w-8 text-primary/30" />
    </div>
    <h3 className="text-base font-semibold tracking-tight mb-1.5">Nenhuma Conversa Selecionada</h3>
    <p className="text-sm text-muted-foreground/50 max-w-[240px]">Selecione uma conversa da lista para ver as mensagens.</p>
  </div>
);

interface InboxViewProps {
  preselectedConversationId?: string;
  initialConversations?: Conversation[];
  initialTemplates?: any[];
}

export function InboxView({ preselectedConversationId, initialConversations, initialTemplates }: InboxViewProps) {
  const controller = useInboxController({
    preselectedConversationId,
    initialConversations,
    initialTemplates
  });
  const isMobileDetected = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMobile = mounted ? isMobileDetected : false;

  if (controller.initialLoading) {
    return <InboxSkeleton />;
  }

  const showConversationList = !isMobile || (isMobile && !controller.selectedConversation);
  const showActiveChat = !isMobile || (isMobile && !!controller.selectedConversation);

  return (
    <>
      <div className="h-full flex flex-row overflow-hidden bg-background relative shadow-none">
        {showConversationList && (
          <div className="w-full md:min-w-[320px] md:max-w-[400px] lg:max-w-[420px] md:w-[30%] flex-shrink-0 h-full border-r border-border/40 min-h-0 overflow-hidden bg-background">
            <ConversationList
              conversations={controller.conversations}
              currentConversationId={controller.selectedConversation?.id || null}
              onSelectConversation={controller.handleSelectConversation}
              onLoadMore={controller.loadMoreConversations}
              hasMore={controller.hasMoreConversations}
              isLoadingMore={controller.isLoadingMoreConversations}
              searchTerm={controller.searchTerm}
              onSearchChange={controller.handleSearchChange}
              isSearching={controller.isSearching}
              activeFilter={controller.activeFilter}
              onFilterChange={controller.handleFilterChange}
              advancedFilters={controller.advancedFilters}
              onAdvancedFiltersChange={controller.handleAdvancedFiltersChange}
            />
          </div>
        )}

        {showActiveChat ? (
          controller.selectedConversation ? (
            <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
              <ActiveChat
                key={controller.selectedConversation.id}
                conversation={controller.selectedConversation}
                contact={controller.selectedContact}
                messages={controller.currentMessages}
                loadingMessages={controller.loadingMessages}
                templates={controller.templates}
                onSendMessage={controller.handleSendMessage}
                onBack={() => controller.handleSelectConversation('')}
                onToggleAi={controller.handleToggleAi}
                onLoadMoreMessages={controller.loadMoreMessages}
                hasMoreMessages={controller.hasMoreMessages}
                isLoadingMoreMessages={controller.isLoadingMoreMessages}
                showContactDetails={controller.showContactDetails}
                onToggleContactDetails={() => controller.setShowContactDetails(prev => !prev)}
                availableConnections={controller.availableConnections}
                onSwitchConnection={controller.handleSwitchConnection}
                onRefreshConversations={() => controller.handleFilterChange(controller.activeFilter)}
                onSyncHistory={controller.handleSyncHistory}
              />
            </div>
          ) : (
            <NoConversationSelected />
          )
        ) : null}
      </div>

      {/* Contact Details — Glass Popup Overlay */}
      {controller.showContactDetails && controller.selectedConversation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => controller.setShowContactDetails(false)}
        >
          {/* Backdrop: dark + blur */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Glass Panel */}
          <div
            className={cn(
              "relative z-10 w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-y-auto",
              "bg-card/95 backdrop-blur-xl",
              "border border-white/[0.08]",
              "shadow-2xl shadow-black/40",
              "animate-in slide-in-from-bottom-4 zoom-in-95 duration-300"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-20 h-8 w-8 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => controller.setShowContactDetails(false)}
            >
              <X className="h-4 w-4" />
            </Button>

            <ContactDetailsPanel 
              contactId={controller.selectedConversation.contactId}
              isArchived={controller.selectedConversation.status === 'ARCHIVED' || controller.selectedConversation.status === 'archived'}
              onArchive={controller.handleArchive}
              onUnarchive={controller.handleUnarchive}
            />
          </div>
        </div>
      )}
    </>
  );
}
