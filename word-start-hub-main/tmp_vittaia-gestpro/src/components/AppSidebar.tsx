import { Home, MessageSquare, Activity, MessageCircle, Code2, Sparkles, Users, UsersRound, Calendar, DollarSign, LogOut, Settings, ChevronRight, Building2, Zap, GitBranch, Workflow, Megaphone, MapPin, Mail, Sun, Moon, UserCheck, Lock, Construction, Stethoscope, BarChart3 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTheme } from "@/hooks/useTheme";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
interface AppSidebarProps {
  totalUnread: number;
}

type AppPage = 'dashboard' | 'leads' | 'pipeline' | 'chat' | 'users' | 'developer' | 'promptia' | 'agenda' | 'teams' | 'financeiro' | 'organizations' | 'commands' | 'automations' | 'disparos' | 'diagnostico' | 'marketing';

const routeToPage: Record<string, AppPage> = {
  '/dashboard': 'dashboard',
  '/chat': 'chat',
  '/agenda': 'agenda',
  '/leads': 'leads',
  '/pipeline': 'pipeline',
  '/crm': 'pipeline',
  '/financeiro': 'financeiro',
  '/teams': 'teams',
  '/users': 'users',
  '/promptia': 'promptia',
  '/developer': 'developer',
  '/organizations': 'organizations',
  '/commands': 'commands',
  '/automations': 'automations',
  '/disparos': 'disparos',
  '/diagnostico-leads': 'diagnostico',
  '/marketing': 'marketing',
};

export function AppSidebar({ totalUnread }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { open } = useSidebar();
  const { user } = useCurrentUser();
  const { isSuperAdmin, organizations, currentOrganization } = useOrganization();
  const { permissions, isLoading: permissionsLoading } = usePagePermissions();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  // Read show_all_tabs preference from localStorage
  const [showAllTabs, setShowAllTabs] = useState(() => {
    return localStorage.getItem('show_all_tabs') === 'true';
  });

  // Listen for storage changes
  useEffect(() => {
    const handler = () => setShowAllTabs(localStorage.getItem('show_all_tabs') === 'true');
    window.addEventListener('storage', handler);
    // Also listen for custom event
    window.addEventListener('show_all_tabs_changed', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('show_all_tabs_changed', handler);
    };
  }, []);

  const allMenuItems = [
    { title: t('nav.dashboard'), url: "/dashboard", icon: Home },
    { title: t('nav.chat'), url: "/chat", icon: MessageSquare, badge: totalUnread },
    { title: t('nav.agenda'), url: "/agenda", icon: Calendar },
    { title: t('nav.commands'), url: "/commands", icon: Zap },
    { title: t('nav.leads'), url: "/leads", icon: UserCheck },
    { title: t('nav.pipeline'), url: "/pipeline", icon: Activity },
    { title: t('nav.crm'), url: "/crm", icon: GitBranch },
    { title: t('nav.leadDiagnostic', 'Diagnóstico de Leads'), url: "/diagnostico-leads", icon: Stethoscope },
    { title: t('nav.marketing', 'Marketing'), url: "/marketing", icon: BarChart3 },
    { title: t('nav.automations'), url: "/automations", icon: Workflow },
    { title: t('nav.broadcasts'), url: "/disparos", icon: Megaphone },
    { title: t('nav.financial'), url: "/financeiro", icon: DollarSign },
    { title: t('nav.teams'), url: "/teams", icon: UsersRound },
  ];

  // Itens em desenvolvimento - apenas super admin
  const devInProgressItems = [
    { title: t('nav.googleBusiness'), url: "/google-business", icon: MapPin },
    { title: t('nav.email'), url: "/email", icon: Mail },
  ];

  // Gestão da Plataforma - apenas super admin
  const superAdminItems = [
    { title: t('nav.platformManagement'), url: "/organizations", icon: Building2 },
  ];

  const allDeveloperItems = [
    { title: t('nav.developer'), url: "/developer", icon: Code2 },
  ];

  // Filtrar itens do menu baseado nas permissões
  // Se showAllTabs = true, mostrar todos mas marcar os bloqueados
  const menuItems = allMenuItems.filter(item => {
    const page = routeToPage[item.url];
    if (!page) return true;
    if (showAllTabs) return true; // Show all, we'll mark locked ones
    return permissions.includes(page);
  });

  // Filtrar itens de desenvolvedor
  const developerItems = allDeveloperItems.filter(item => {
    const page = routeToPage[item.url];
    if (!page) return true;
    if (showAllTabs) return true;
    return permissions.includes(page);
  });

  const isLocked = (url: string): boolean => {
    const page = routeToPage[url];
    if (!page) return false;
    return !permissions.includes(page);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Sign out err:", e);
    } finally {
      queryClient.clear();
      localStorage.clear();
      navigate("/auth");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3 mx-0">
        <div className="flex flex-col items-center w-full gap-3">
          {open ? (
            <>
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                  <AvatarImage src={user?.avatar_url} alt={user?.full_name || user?.email} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm">
                    {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.full_name || t('common.user')}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">
                    {user?.email}
                  </p>
                </div>
                <SidebarTrigger className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10 rounded-lg transition-all" />
              </div>
            </>
          ) : (
            <>
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarImage src={user?.avatar_url} alt={user?.full_name || user?.email} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm">
                  {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <SidebarTrigger className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10 rounded-lg transition-all" />
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarMenu className="space-y-0.5">
          {menuItems.map(item => {
            const locked = isLocked(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  onClick={() => navigate(item.url)}
                  isActive={isActive(item.url)}
                  tooltip={locked ? `${item.title} (bloqueado)` : item.title}
                  className={cn(
                    "relative transition-all group rounded-lg h-9 text-[13px]",
                    locked
                      ? "text-sidebar-foreground/30 hover:text-sidebar-foreground/40 hover:bg-sidebar-foreground/5"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5",
                    "data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-accent/20",
                    "data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm data-[active=true]:shadow-primary/20",
                    open ? "pl-3 pr-3 justify-start" : "justify-center px-0"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 flex-shrink-0", locked && "opacity-40")} />
                  {open && <span className={cn("ml-2 font-medium", locked && "opacity-40")}>{item.title}</span>}
                  {open && locked && (
                    <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
                  )}
                  {open && !locked && isActive(item.url) && <ChevronRight className="ml-auto h-4 w-4 opacity-60" />}
                  {open && !locked && item.badge !== undefined && item.badge > 0 && (
                    <div className="ml-auto h-5 min-w-5 bg-destructive rounded-full flex items-center justify-center shadow-lg px-1.5 animate-pulse">
                      <span className="text-[10px] font-bold text-destructive-foreground">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    </div>
                  )}
                  {!open && locked && (
                    <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-muted rounded-full flex items-center justify-center">
                      <Lock className="h-2 w-2 text-muted-foreground" />
                    </div>
                  )}
                  {!open && !locked && item.badge !== undefined && item.badge > 0 && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full flex items-center justify-center shadow-lg animate-pulse">
                      <span className="text-[8px] font-bold text-destructive-foreground">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    </div>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          {/* Super admin only items */}
          {isSuperAdmin && superAdminItems.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                onClick={() => navigate(item.url)}
                isActive={isActive(item.url)}
                tooltip={item.title}
                className={cn(
                  "relative transition-all group rounded-lg h-9 text-[13px]",
                  "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5",
                  "data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-accent/20",
                  "data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm data-[active=true]:shadow-primary/20",
                  open ? "pl-3 pr-3 justify-start" : "justify-center px-0"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {open && <span className="ml-2 font-medium">{item.title}</span>}
                {open && isActive(item.url) && <ChevronRight className="ml-auto h-4 w-4 opacity-60" />}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {/* Dev in progress - super admin only */}
          {isSuperAdmin && devInProgressItems.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                onClick={() => navigate(item.url)}
                isActive={isActive(item.url)}
                tooltip={`${item.title} (em desenvolvimento)`}
                className={cn(
                  "relative transition-all group rounded-lg h-9 text-[13px]",
                  "text-sidebar-foreground/40 hover:text-sidebar-foreground/60 hover:bg-sidebar-foreground/5",
                  "data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-accent/20",
                  "data-[active=true]:text-sidebar-foreground",
                  open ? "pl-3 pr-3 justify-start" : "justify-center px-0"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {open && <span className="ml-2 font-medium">{item.title}</span>}
                {open && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-500">
                    <Construction className="h-3 w-3" />
                    Dev
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2 mt-auto space-y-0.5">
        {/* Developer section - only show if there are visible items */}
        {developerItems.length > 0 && (
          <SidebarMenu className="mb-1.5 pb-1.5 border-b border-sidebar-border space-y-0.5">
            {developerItems.map(item => {
              const locked = isLocked(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={locked ? `${item.title} (bloqueado)` : item.title}
                    className={cn(
                      "relative transition-all group rounded-lg h-9 text-[13px]",
                      locked
                        ? "text-sidebar-foreground/30 hover:text-sidebar-foreground/40 hover:bg-sidebar-foreground/5"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5",
                      "data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-accent/20",
                      "data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm data-[active=true]:shadow-primary/20",
                      open ? "justify-start pl-3 pr-3" : "justify-center px-0"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 flex-shrink-0", locked && "opacity-40")} />
                    {open && <span className={cn("ml-2 font-medium", locked && "opacity-40")}>{item.title}</span>}
                    {open && locked && (
                      <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                    {open && !locked && isActive(item.url) && <ChevronRight className="ml-auto h-4 w-4 opacity-60" />}
                    {!open && locked && (
                      <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-muted rounded-full flex items-center justify-center">
                        <Lock className="h-2 w-2 text-muted-foreground" />
                      </div>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        )}

        {/* Organization Switcher for multi-org users */}
        {!isSuperAdmin && organizations.length > 1 && (
          <SidebarMenu className="mb-1.5 pb-1.5 border-b border-sidebar-border space-y-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate('/select-organization')}
                tooltip="Trocar organização"
                className={cn(
                  "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5 transition-all rounded-lg h-9 text-[13px]",
                  open ? "justify-start pl-3 pr-3" : "justify-center px-0"
                )}
              >
                <Building2 className="h-4 w-4 flex-shrink-0" />
                {open && (
                  <>
                    <span className="ml-2 font-medium truncate max-w-[120px]">
                      {currentOrganization?.name || 'Organização'}
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 opacity-60" />
                  </>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        {/* Profile and Logout section */}
        <SidebarMenu className="space-y-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              className={cn(
                "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5 transition-all rounded-lg h-9 text-[13px]",
                open ? "justify-start pl-3 pr-3" : "justify-center px-0"
              )}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 flex-shrink-0" /> : <Moon className="h-4 w-4 flex-shrink-0" />}
              {open && <span className="ml-2 font-medium">{theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate('/meu-plano')}
              isActive={isActive('/meu-plano')}
              tooltip={t('nav.myPlan')}
              className={cn(
                "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5 transition-all rounded-lg h-9 text-[13px]",
                "data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-accent/20",
                "data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm data-[active=true]:shadow-primary/20",
                open ? "justify-start pl-3 pr-3" : "justify-center px-0"
              )}
            >
              <Sparkles className="h-4 w-4 flex-shrink-0" />
              {open && <span className="ml-2 font-medium">{t('nav.myPlan')}</span>}
              {open && isActive('/meu-plano') && <ChevronRight className="ml-auto h-4 w-4 opacity-60" />}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate('/profile')}
              isActive={isActive('/profile')}
              tooltip={t('nav.settings')}
              className={cn(
                "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/5 transition-all rounded-lg h-9 text-[13px]",
                "data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/20 data-[active=true]:to-accent/20",
                "data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm data-[active=true]:shadow-primary/20",
                open ? "justify-start pl-3 pr-3" : "justify-center px-0"
              )}
            >
              <Settings className="h-4 w-4 flex-shrink-0" />
              {open && <span className="ml-2 font-medium">{t('nav.settings')}</span>}
              {open && isActive('/profile') && <ChevronRight className="ml-auto h-4 w-4 opacity-60" />}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip={t('nav.logout')}
              className={cn(
                "text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all rounded-lg h-9 text-[13px]",
                open ? "justify-start pl-3 pr-3" : "justify-center px-0"
              )}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {open && <span className="ml-2 font-medium">{t('nav.logout')}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
