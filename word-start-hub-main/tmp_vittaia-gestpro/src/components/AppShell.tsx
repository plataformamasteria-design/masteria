import { ReactNode, useEffect, useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { DunningBanner } from "@/components/DunningBanner";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useAudioNotifications } from "@/hooks/useAudioNotifications";
import { useTheme } from "@/hooks/useTheme";
import { useLocation } from "react-router-dom";
import { BroadcastRunnerOverlay } from "@/components/disparos/BroadcastRunnerOverlay";

interface AppShellProps {
  children: ReactNode;
  noPadding?: boolean;
}

export default function AppShell({ children, noPadding }: AppShellProps) {
  const { totalUnread } = useUnreadMessages();
  const { playNotificationSound } = useAudioNotifications();
  const { theme } = useTheme();
  const prevUnreadRef = useRef(totalUnread);
  const originalTitleRef = useRef(document.title);
  const tabJustBecameVisibleRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const routeJustChangedRef = useRef(false);
  const location = useLocation();

  // Keeps user presence updated for dynamic distribution.
  usePresenceHeartbeat();

  // Track tab visibility changes – suppress sound for 2s after returning to tab
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) {
        tabJustBecameVisibleRef.current = true;
        setTimeout(() => { tabJustBecameVisibleRef.current = false; }, 2000);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Suppress sound for 5s after internal route change
  useEffect(() => {
    routeJustChangedRef.current = true;
    // Reset the previous unread count to current after route change settles,
    // so stale re-fetches don't trigger sound
    const t = setTimeout(() => { routeJustChangedRef.current = false; }, 5000);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Snapshot unread count whenever route changes so re-fetches don't look like "new" messages
  useEffect(() => {
    prevUnreadRef.current = totalUnread;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Browser title update with unread count
  useEffect(() => {
    const baseTitle = originalTitleRef.current.replace(/^\(\d+\)\s*/, '');
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
    return () => { document.title = baseTitle; };
  }, [totalUnread]);

  // Play sound only for genuinely new messages while tab is focused (not after tab switch or route change)
  useEffect(() => {
    if (isInitialMountRef.current) {
      prevUnreadRef.current = totalUnread;
      isInitialMountRef.current = false;
      return;
    }

    // Only play if count genuinely increased AND we're not in a suppression window
    if (totalUnread > prevUnreadRef.current) {
      const isGenuineNewMessage = !document.hidden && !tabJustBecameVisibleRef.current && !routeJustChangedRef.current;
      if (isGenuineNewMessage) {
        playNotificationSound();
      }
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('Nova mensagem', {
          body: `Você tem ${totalUnread} conversa${totalUnread > 1 ? 's' : ''} não lida${totalUnread > 1 ? 's' : ''}.`,
          icon: '/favicon.ico',
          tag: 'unread-messages',
        });
        setTimeout(() => n.close(), 5000);
      }
    }
    prevUnreadRef.current = totalUnread;
  }, [totalUnread, playNotificationSound]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <SidebarProvider>
      <div className={`app-themed h-[100dvh] flex w-full bg-background overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
        <div className="hidden md:flex md:h-full">
          <AppSidebar totalUnread={totalUnread} />
        </div>

        <main className="flex-1 flex flex-col overflow-hidden max-w-full min-h-0 bg-gradient-to-br from-background/95 via-background to-background/95">
          <DunningBanner />
          <BroadcastRunnerOverlay />

          <div className={noPadding ? "flex-1 overflow-hidden pb-16 md:pb-0" : "flex-1 overflow-auto p-3 md:p-4 pb-20 md:pb-4"}>
            {children}
          </div>
        </main>

        <MobileBottomNav totalUnread={totalUnread} />
      </div>
    </SidebarProvider>
  );
}
