'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Settings, Bell, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConnectionStatusBadge } from '@/components/dashboard/connection-status-badge';
import VersionBadge from '@/components/version-badge';
import { useSession } from '@/contexts/session-context';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { motion, AnimatePresence } from 'framer-motion';
// Assuming useNotifications is available or we stub it inside if not needed here
import { useNotifications } from '@/hooks/use-notifications';

interface SidebarFooterProps {
    expanded: boolean;
    isMobile: boolean;
    isPinned: boolean;
    onPinToggle: () => void;
    onMobileClose?: () => void;
}

export function SidebarFooter({ expanded, isMobile, isPinned, onPinToggle, onMobileClose }: SidebarFooterProps) {
    const { session, loading } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const { toast } = useToast();
    const notify = createToastNotifier(toast);
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    
    useEffect(() => setMounted(true), []);

    // Real implementation for notifications
    const { notifications, unreadCount, markAsRead, mounted: notifMounted } = useNotifications(30000);

    const userName = session?.userData?.name || 'Utilizador';
    const userRole = session?.userData?.role;
    const userEmail = session?.userData?.email || 'email@exemplo.com';

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            await signOut({ callbackUrl: '/login', redirect: true });
        } catch (error) {
            console.error("Logout failed:", error);
            notify.error('Erro ao Sair', 'Não foi possível fazer o logout.');
            router.push('/login');
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="mt-auto shrink-0 px-3 pb-4">
            <div className="sidebar-separator mx-0 mb-3" />

            <div className="flex flex-col gap-1">
                {/* Utility Icon Bar */}
                <div className={cn(
                    "flex items-center justify-center gap-1 py-1",
                    expanded && "px-1"
                )}>
                    {/* Connection Status */}
                    <TooltipProvider>
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <div className="flex items-center justify-center h-9 w-9 rounded-xl cursor-default transition-all duration-300 hover:bg-white/[0.04]">
                                    <ConnectionStatusBadge />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-card/95 backdrop-blur-md border border-white/[0.05] shadow-xl">
                                Status de Conexão
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Notifications */}
                    <DropdownMenu>
                        <TooltipProvider>
                            <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="relative h-9 w-9 rounded-xl text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-white/[0.04]"
                                        >
                                            <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
                                            <AnimatePresence>
                                                {notifMounted && unreadCount > 0 && (
                                                    <motion.span
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        exit={{ scale: 0 }}
                                                        className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm"
                                                    >
                                                        {unreadCount}
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-card/95 backdrop-blur-md border border-white/[0.05] shadow-xl">
                                    Notificações
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <DropdownMenuContent align="end" side="right" className="w-80 max-h-[400px] overflow-y-auto bg-card/95 backdrop-blur-2xl border-white/[0.05] shadow-2xl">
                            <DropdownMenuLabel className="font-bold tracking-tight">Registro de Alertas</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border/50" />
                            {notifications.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground opacity-70">
                                    Nenhuma notificação recente
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <DropdownMenuItem
                                        key={notification.id}
                                        className={cn(
                                            "flex flex-col items-start gap-1 cursor-pointer transition-colors focus:bg-white/[0.05]",
                                            !notification.isRead && "bg-primary/5"
                                        )}
                                        onClick={() => {
                                            if (!notification.isRead) markAsRead(notification.id);
                                            if (notification.linkTo) router.push(notification.linkTo);
                                        }}
                                    >
                                        <div className="flex justify-between items-start w-full">
                                            <p className={cn("text-sm", !notification.isRead ? "font-bold text-primary" : "font-semibold")}>
                                                {notification.title}
                                            </p>
                                            <span className="text-[10px] text-muted-foreground">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                                    </DropdownMenuItem>
                                ))
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Settings */}
                    {(userRole === 'admin' || userRole === 'superadmin') && !loading && (
                        <TooltipProvider>
                            <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href="/settings"
                                        className={cn(
                                            'group flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-white/[0.04]',
                                            pathname.startsWith('/settings') && 'bg-primary/10 text-primary'
                                        )}
                                        onClick={isMobile && onMobileClose ? onMobileClose : undefined}
                                    >
                                        <Settings className={cn(
                                            "h-[18px] w-[18px] transition-colors duration-200",
                                            pathname.startsWith('/settings') ? "text-primary saturate-150" : "group-hover:text-foreground"
                                        )} strokeWidth={1.8} />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-card/95 backdrop-blur-md border border-white/[0.05] shadow-xl">
                                    Configurações
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Theme Toggle */}
                    <TooltipProvider>
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-xl text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-white/[0.04]"
                                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                                >
                                    {mounted ? (
                                        resolvedTheme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />
                                    ) : (
                                        <Moon className="h-[18px] w-[18px]" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-card/95 backdrop-blur-md border border-white/[0.05] shadow-xl">
                                Alternar Tema
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="sidebar-separator mx-0 my-2" />

                {/* User Card */}
                <DropdownMenu>
                    <TooltipProvider>
                        <Tooltip delayDuration={expanded ? 1000 : 0}>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            'group flex h-10 items-center justify-start rounded-xl text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-white/[0.05] outline-none',
                                            !expanded && 'justify-center w-10 px-0 mx-auto'
                                        )}
                                    >
                                        <Avatar className="h-7 w-7 shrink-0 shadow-sm border border-white/[0.05]">
                                            <AvatarImage src={session?.userData?.avatarUrl || ''} alt={userName} />
                                            <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-black tracking-tight">
                                                {userName?.substring(0, 2).toUpperCase() || 'U'}
                                            </AvatarFallback>
                                        </Avatar>

                                        <AnimatePresence mode="popLayout">
                                            {expanded && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -10 }}
                                                    className="ml-3 flex flex-col items-start min-w-0"
                                                >
                                                    <span className="text-[13px] font-bold text-foreground truncate max-w-[120px] tracking-tight">{userName}</span>
                                                    <span className="text-[10px] uppercase font-semibold text-primary/80 truncate tracking-widest">{userRole}</span>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            {!expanded && (
                                <TooltipContent side="right" className="bg-card/95 backdrop-blur-md border border-white/[0.05] shadow-xl">
                                    {userName}
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>

                    <DropdownMenuContent align="end" side={expanded ? "bottom" : "right"} className="w-56 bg-card/95 backdrop-blur-2xl border-white/[0.05] shadow-2xl p-2 rounded-xl">
                        <div className="flex flex-col space-y-1 p-2">
                            <p className="text-sm font-bold text-foreground tracking-tight leading-none">{userName}</p>
                            <p className="text-[11px] text-muted-foreground leading-none">{userEmail}</p>
                        </div>
                        <DropdownMenuSeparator className="bg-border/50" />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-semibold tracking-tight rounded-lg mt-1"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            {isLoggingOut ? 'Saindo...' : 'Encerrar Sessão'}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 flex justify-center w-full"
                        >
                            <VersionBadge />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
