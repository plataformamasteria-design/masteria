'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Settings, Bell, Moon, Sun, User, SlidersHorizontal, Plug, CreditCard } from 'lucide-react';
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
import { m as motion, AnimatePresence } from 'framer-motion';
import { NotificationPopover } from '@/components/notifications/notification-popover';

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

    const userName = session?.userData?.name || 'Utilizador';
    const userRole = session?.userData?.role;
    const userEmail = session?.userData?.email || 'email@exemplo.com';

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            await signOut({ callbackUrl: '/', redirect: true });
        } catch (error) {
            console.error("Logout failed:", error);
            notify.error('Erro ao Sair', 'Não foi possível fazer o logout.');
            router.push('/');
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="mt-auto shrink-0 px-3 pb-4 pt-4">
            <div className="sidebar-separator mx-0 mb-4" />

            <div className="flex flex-col gap-1">
                {/* Utility Icon Bar */}
                <div className={cn(
                    "flex flex-wrap items-center justify-center transition-all duration-300",
                    expanded ? "gap-1.5 py-2 px-3 mx-4 rounded-3xl bg-white/70 dark:bg-black/50 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[0_0_20px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.05)]" : "gap-3 py-1 px-0 mx-0 flex-col bg-transparent border-transparent shadow-none"
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
                    <NotificationPopover />



                    {/* Theme Toggle */}
                    <TooltipProvider>
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-2xl text-muted-foreground transition-all duration-300 hover:text-foreground dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
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

                {/* User Card */}
                <DropdownMenu>
                    <TooltipProvider>
                        <Tooltip delayDuration={expanded ? 1000 : 0}>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            'group flex items-center justify-start rounded-3xl text-muted-foreground transition-all duration-300 outline-none border hover:bg-black/5 dark:hover:bg-black/40 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)]',
                                            expanded ? 'h-16 px-3 w-[calc(100%-1rem)] mx-2 border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]' : 'h-14 w-14 justify-center px-0 mx-auto border-transparent hover:border-black/10 dark:hover:border-white/10 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]'
                                        )}
                                    >
                                        <Avatar className={cn("shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-black/10 dark:border-white/10 transition-transform duration-300 group-hover:scale-105 group-hover:border-emerald-500/30", expanded ? "h-10 w-10" : "h-10 w-10")}>
                                            <AvatarImage src={session?.userData?.avatarUrl || ''} alt={userName} />
                                            <AvatarFallback className="text-[12px] bg-emerald-500/20 text-emerald-400 font-black tracking-tight">
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

                    <DropdownMenuContent align="end" side={expanded ? "bottom" : "right"} className="w-64 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl p-2 rounded-2xl">
                        {/* User identity */}
                        <div className="flex items-center gap-3 p-3 mb-1">
                            <Avatar className="h-10 w-10 ring-1 ring-emerald-500/30">
                                <AvatarImage src={session?.userData?.avatarUrl || ''} alt={userName} />
                                <AvatarFallback className="text-xs bg-emerald-500/20 text-emerald-400 font-black">
                                    {userName?.substring(0, 2).toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground dark:text-white truncate">{userName}</p>
                                <p className="text-[11px] text-muted-foreground dark:text-zinc-500 truncate">{userEmail}</p>
                            </div>
                        </div>
                        <DropdownMenuSeparator className="bg-black/5 dark:bg-white/5 my-1" />

                        {/* Navigation Items */}
                        <DropdownMenuItem asChild>
                            <Link
                                href="/perfil"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-zinc-600 dark:text-zinc-300 hover:text-foreground dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-150 group"
                                onClick={isMobile && onMobileClose ? onMobileClose : undefined}
                            >
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                                    <User className="h-3.5 w-3.5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-semibold">Perfil</p>
                                    <p className="text-[10px] text-muted-foreground dark:text-zinc-500">Dados pessoais e segurança</p>
                                </div>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                            <Link
                                href="/preferencias"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-zinc-600 dark:text-zinc-300 hover:text-foreground dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-150 group"
                                onClick={isMobile && onMobileClose ? onMobileClose : undefined}
                            >
                                <div className="p-1.5 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                                    <SlidersHorizontal className="h-3.5 w-3.5 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-semibold">Preferências</p>
                                    <p className="text-[10px] text-muted-foreground dark:text-zinc-500">Tema, idioma e notificações</p>
                                </div>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                            <Link
                                href="/conexoes"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-zinc-600 dark:text-zinc-300 hover:text-foreground dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-150 group"
                                onClick={isMobile && onMobileClose ? onMobileClose : undefined}
                            >
                                <div className="p-1.5 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                                    <Plug className="h-3.5 w-3.5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-semibold">Conexões</p>
                                    <p className="text-[10px] text-muted-foreground dark:text-zinc-500">WhatsApp e dispositivos</p>
                                </div>
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                            <Link
                                href="/faturamento"
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-zinc-600 dark:text-zinc-300 hover:text-foreground dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-150 group"
                                onClick={isMobile && onMobileClose ? onMobileClose : undefined}
                            >
                                <div className="p-1.5 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                                    <CreditCard className="h-3.5 w-3.5 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-semibold">Faturamento</p>
                                    <p className="text-[10px] text-muted-foreground dark:text-zinc-500">Plano, uso e faturas</p>
                                </div>
                            </Link>
                        </DropdownMenuItem>

                        {(userRole === 'admin' || userRole === 'superadmin') && !loading && (
                            <DropdownMenuItem asChild>
                                <Link
                                    href="/settings"
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-zinc-600 dark:text-zinc-300 hover:text-foreground dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-150 group"
                                    onClick={isMobile && onMobileClose ? onMobileClose : undefined}
                                >
                                    <div className="p-1.5 rounded-lg bg-zinc-500/10 group-hover:bg-zinc-500/20 transition-colors">
                                        <Settings className="h-3.5 w-3.5 text-muted-foreground dark:text-zinc-400" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold">Configurações</p>
                                        <p className="text-[10px] text-muted-foreground dark:text-zinc-500">Empresa, equipe e integrações</p>
                                    </div>
                                </Link>
                            </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator className="bg-black/5 dark:bg-white/5 my-1" />

                        <DropdownMenuItem
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150 font-semibold"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                        >
                            <div className="p-1.5 rounded-lg bg-red-500/10">
                                <LogOut className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[13px]">{isLoggingOut ? 'Saindo...' : 'Encerrar Sessão'}</span>
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
