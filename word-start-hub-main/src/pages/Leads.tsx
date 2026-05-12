import { useState, useEffect, useRef } from "react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, UserCheck, Search, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import BotGlobalControl from "@/components/leads/BotGlobalControl";
import MassDeactivateDialog from "@/components/leads/MassDeactivateDialog";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";
import { DeleteLeadDialog } from "@/components/leads/DeleteLeadDialog";
import { LeadCardSkeletonGrid } from "@/components/leads/LeadCardSkeleton";
import { LeadCard } from "@/components/leads/LeadCard";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useLeadsPaginated } from "@/hooks/useLeadsPaginated";
import { MultiTagFilter } from "@/components/ui/multi-tag-filter";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface Tag { id: string; name: string; color: string; }

const Robot = () => {
  const { t } = useTranslation();
  const { canUseBotActivation, canUseAIAutomation } = useModuleAccess();
  const { chats, loading, loadingMore, hasMore, search, setSearch, selectedTags, setSelectedTags, loadMore, refreshChats, forceRefresh } = useLeadsPaginated();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [deletingChatName, setDeletingChatName] = useState<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('vitta_leads_viewMode');
    return (saved as 'grid' | 'list') || 'grid';
  });

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('vitta_leads_viewMode', mode);
  };

  useEffect(() => { if (!currentOrganization?.id) return; fetchTags(); }, [currentOrganization?.id]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) loadMore();
    }, { rootMargin: '200px' });
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [loadMore, hasMore, loadingMore, loading]);

  const fetchTags = async () => {
    let query = supabase.from("tags").select("*");
    if (currentOrganization?.id) query = query.eq('organization_id', currentOrganization.id);
    const { data } = await query.order("order_position", { ascending: true });
    setTags(data || []);
  };

  const handleToggleBot = async (chatId: string, currentState: boolean) => {
    try {
      const newState = !currentState;
      const { error: updateError } = await supabase.from("chats").update({ agent_off: newState }).eq("id", chatId);
      if (updateError) throw updateError;
      toast({ title: newState ? t('leads.botDeactivated') : t('leads.botActivated'), description: t('leads.botToggleDesc', { state: newState ? t('common.deactivated') : t('common.activated') }) });
      refreshChats();
    } catch (err: any) {
      toast({ title: t('leads.errorUpdatingBot'), description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveTag = async (chatId: string, tagId: string) => {
    const { error } = await supabase.from("chat_tags").delete().eq("chat_id", chatId).eq("tag_id", tagId);
    if (error) { toast({ title: t('leads.errorRemovingTag'), description: error.message, variant: "destructive" }); return; }
    refreshChats();
  };

  const handleDeleteClick = (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    setDeletingChatName((chat as any)?.custom_name || chat?.wa_name || (chat as any)?.group_name || chat?.phone || '');
    setDeletingChatId(chatId);
  };

  const handleDeleteComplete = () => { setDeletingChatId(null); setDeletingChatName(''); forceRefresh(); };

  return (
    <AppShell>
      <PagePermissionGuard page="leads">
        <div className="p-4 md:p-6 space-y-6">
          <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shrink-0">
                <UserCheck className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-3xl font-bold tracking-tight">{t('leads.title')}</h1>
                <p className="text-muted-foreground text-xs md:text-sm truncate">{t('leads.subtitle')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50 mr-1 shadow-sm">
              <button
                onClick={() => toggleViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-md transition-all duration-200 flex items-center justify-center",
                  viewMode === 'grid'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
                title={t('leads.gridView', 'Grade')}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => toggleViewMode('list')}
                className={cn(
                  "p-1.5 rounded-md transition-all duration-200 flex items-center justify-center",
                  viewMode === 'list'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
                title={t('leads.listView', 'Lista')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {canUseBotActivation && <BotGlobalControl onRefresh={forceRefresh} />}
            {canUseAIAutomation && <MassDeactivateDialog onComplete={forceRefresh} />}
            <Button onClick={forceRefresh} variant="outline" size="sm" disabled={loading} className="h-9">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-2 hidden sm:inline">{t('leads.refresh')}</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder={t('leads.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10" />
          </div>
          <MultiTagFilter tags={tags} selectedTags={selectedTags} onSelectedTagsChange={setSelectedTags} placeholder={t('leads.filterByTags')} />
        </div>

        {loading && chats.length === 0 ? (
          <div className={cn(
            "grid gap-3 md:gap-4 max-w-full",
            viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            <LeadCardSkeletonGrid count={6} />
          </div>
        ) : chats.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            {search || selectedTags.length > 0 ? t('leads.noChatsFound') : t('leads.noChatsAvailable')}
          </CardContent></Card>
        ) : (
          <div className={cn(
            "grid gap-3 md:gap-4 max-w-full",
            viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            {chats.map((chat) => (
              <LeadCard
                key={chat.id}
                chat={chat}
                layout={viewMode}
                onToggleBot={handleToggleBot}
                onRemoveTag={handleRemoveTag}
                onRefresh={refreshChats}
                onClick={() => setSelectedChatId(chat.id)}
                onNavigateToChat={() => navigate(`/chat?id=${chat.id}`)}
                onDelete={handleDeleteClick}
              />
            ))}
            {hasMore && (<div ref={loadMoreRef} className="col-span-full p-4 text-center">{loadingMore && <LeadCardSkeletonGrid count={2} />}</div>)}
          </div>
        )}
      <LeadDetailDialog open={!!selectedChatId} onOpenChange={(open) => !open && setSelectedChatId(null)} chatId={selectedChatId} />
      <DeleteLeadDialog open={!!deletingChatId} onOpenChange={(open) => !open && setDeletingChatId(null)} chatId={deletingChatId || ''} chatName={deletingChatName} onDeleted={handleDeleteComplete} />
        </div>
      </PagePermissionGuard>
    </AppShell >
  );
};

export default Robot;