import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  LayoutDashboard, 
  MessageSquare, 
  UserCheck,
  GitBranch,
  MoreHorizontal,
  Calendar,
  DollarSign,
  UsersRound,
  Settings,
  Sparkles,
  User,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface MobileBottomNavProps {
  totalUnread: number;
}

export function MobileBottomNav({ totalUnread }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleNavigate = (path: string) => {
    navigate(path);
    setSheetOpen(false);
  };

  const handleLogout = async () => {
    setSheetOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: "destructive", title: "Erro ao sair", description: error.message });
    } else {
      queryClient.clear();
      navigate("/auth");
    }
  };

  // Bottom bar: Dashboard, Chat, Leads, CRM, More
  const bottomBarItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: "/chat", icon: MessageSquare, label: t('nav.chat') },
    { path: "/leads", icon: UserCheck, label: t('nav.leads') },
    { path: "/crm", icon: GitBranch, label: t('nav.crm') },
  ];

  // "More" menu items — only allowed ones
  const moreNavItems = [
    { path: "/agenda", icon: Calendar, label: t('nav.agenda') },
    { path: "/financeiro", icon: DollarSign, label: t('nav.financial') },
    { path: "/teams", icon: UsersRound, label: t('nav.teams') },
  ];

  const moreSettingsItems = [
    { path: "/profile", icon: Settings, label: t('nav.settings') },
    { path: "/meu-plano", icon: Sparkles, label: t('nav.myPlan') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {bottomBarItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const showBadge = item.path === "/chat" && totalUnread > 0;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors relative",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <Badge 
                    className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground border-0"
                  >
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}

        {/* "More" button */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t('nav.more')}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
            <SheetHeader className="pb-4">
              <SheetTitle>{t('nav.menu')}</SheetTitle>
            </SheetHeader>
            
            {/* Navigation items */}
            <div className="grid grid-cols-3 gap-3 pb-4">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-colors",
                      active 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <Separator className="my-2" />

            {/* Settings / Plan */}
            <div className="grid grid-cols-3 gap-3 py-4">
              {moreSettingsItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-colors",
                      active 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <Separator className="my-2" />

            {/* Theme toggle + Logout */}
            <div className="flex flex-col gap-1 py-4 pb-8">
              <button
                onClick={() => { toggleTheme(); setSheetOpen(false); }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                <span className="text-sm font-medium">
                  {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-destructive/10 text-destructive transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm font-medium">{t('nav.logout')}</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
