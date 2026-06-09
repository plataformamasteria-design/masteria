'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, Megaphone, MessageSquare, CalendarClock, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotifications, UserNotification } from '@/hooks/use-notifications';

const NotificationIcon = ({ type }: { type: UserNotification['type'] }) => {
  switch (type) {
    case 'campaign_completed':
      return <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500"><Megaphone className="h-4 w-4" /></div>;
    case 'new_conversation':
      return <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-500"><MessageSquare className="h-4 w-4" /></div>;
    case 'new_appointment':
      return <div className="p-1.5 rounded-full bg-purple-500/10 text-purple-500"><CalendarClock className="h-4 w-4" /></div>;
    case 'system_error':
      return <div className="p-1.5 rounded-full bg-red-500/10 text-red-500"><AlertTriangle className="h-4 w-4" /></div>;
    case 'info':
    default:
      return <div className="p-1.5 rounded-full bg-zinc-500/10 text-zinc-500"><Info className="h-4 w-4" /></div>;
  }
};

export function NotificationPopover() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, mounted } = useNotifications(30000);

  const handleNotificationClick = (notification: UserNotification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.linkTo) {
      setIsOpen(false);
      router.push(notification.linkTo);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "relative h-10 w-10 rounded-2xl text-muted-foreground transition-all duration-300 hover:text-foreground dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]",
                  isOpen && "bg-black/[0.05] dark:bg-white/[0.08] text-foreground dark:text-white"
                )}
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
                <AnimatePresence>
                  {mounted && unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-card/95 backdrop-blur-md border border-white/[0.05] shadow-xl">
            Notificações
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" sideOffset={8} className="w-80 sm:w-96 p-0 bg-card/95 backdrop-blur-2xl border-border/50 shadow-2xl rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
          <h3 className="font-bold tracking-tight text-sm">Registro de Alertas</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsRead()}
              className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[380px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground opacity-70">
              <Bell className="h-8 w-8 mb-3 opacity-20" />
              <p className="text-sm">Nenhuma notificação recente</p>
            </div>
          ) : (
            <div className="flex flex-col p-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  role="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "flex gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-muted/50",
                    !notification.isRead && "bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    <NotificationIcon type={notification.type} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <p className={cn("text-sm truncate", !notification.isRead ? "font-bold text-foreground" : "font-medium text-foreground/80")}>
                        {notification.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className={cn("text-xs line-clamp-2", !notification.isRead ? "text-foreground/90" : "text-muted-foreground")}>
                      {notification.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
