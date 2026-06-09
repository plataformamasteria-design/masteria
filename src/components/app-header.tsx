

'use client';

import Link from 'next/link';
import {
  BotMessageSquare,
  MessagesSquare,
  Send,
  MessageSquareText,
  Users,
  Plug,
  Settings,
  PanelLeft,
  Moon,
  Sun,
  Laptop,
  LogOut,
  User,
  LayoutDashboard,
  ClipboardList,
  Bell,
  Loader2,
  GalleryVertical,
  MessageCircle,
  LifeBuoy,
  ShieldCheck,
  FileClock,
  Rocket,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useTheme } from 'next-themes';
import { useSession } from '@/contexts/session-context';
import { signOut } from 'next-auth/react';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import VersionBadge from '@/components/version-badge';
import { ConnectionStatusBadge } from '@/components/dashboard/connection-status-badge';
import { useNotifications } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'atendente', 'superadmin'] },
  { href: '/ajuda', label: 'Primeiros Passos', icon: LifeBuoy, roles: ['admin', 'atendente', 'superadmin'] },
  { href: '/atendimentos', label: 'Atendimentos', icon: MessagesSquare, roles: ['admin', 'atendente', 'superadmin'] },
  { href: '/campaigns', label: 'Campanhas', icon: Send, roles: ['admin', 'superadmin'] },
  { href: '/sms', label: 'SMS', icon: MessageCircle, roles: ['admin', 'superadmin'] },
  { href: '/contacts', label: 'Contatos', icon: Users, roles: ['admin', 'atendente', 'superadmin'] },
  { href: '/lists', label: 'Listas', icon: ClipboardList, roles: ['admin', 'atendente', 'superadmin'] },
  { href: '/templates', label: 'Modelos', icon: MessageSquareText, roles: ['admin', 'superadmin'] },
  { href: '/gallery', label: 'Galeria', icon: GalleryVertical, roles: ['admin', 'superadmin'] },
  { href: '/connections', label: 'Conexões', icon: Plug, roles: ['admin', 'superadmin'] },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const { setTheme } = useTheme();
  const { session } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const userRole = session?.userData?.role;
  const navItems = allNavItems.filter(item => userRole && item.roles.includes(userRole));

  const userName = session?.userData?.name || 'Utilizador';
  const userEmail = session?.userData?.email || 'email@exemplo.com';

  const isSuperAdmin = userRole === 'superadmin';

  // Hook de notificações
  const { notifications, unreadCount, markAsRead, mounted } = useNotifications(30000);


  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // 1. Limpar cookies de sessão personalizados (Backend/Custom JWT)
      // Isso garante que a sessão do lado do servidor (Verificada por getUserSession/middleware) seja destruída.
      await fetch('/api/auth/logout', { method: 'POST' });

      // 2. Limpar sessão do NextAuth (Frontend/Client State)
      // Isso garante que useSession() retorne 'unauthenticated' e destrói o cookie next-auth.session-token.
      // O redirect: true levará o usuário para a página de login automaticamente.
      await signOut({ callbackUrl: '/', redirect: true });
    } catch (error) {
      console.error("Logout failed:", error);
      notify.error('Erro ao Sair', 'Não foi possível fazer o logout. Por favor, tente novamente.');
      // Fallback safety: force redirect via router if signOut fails
      router.push('/');
    } finally {
      if (mounted) {
        setIsLoggingOut(false);
      }
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-4 md:px-6 transition-[width] duration-300"
    )}>
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <SheetHeader className="text-left mb-6">
            <SheetTitle>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 font-bold text-xl"
              >
                <BotMessageSquare className="h-7 w-7 text-primary" />
                <span>Master IA</span>
              </Link>
            </SheetTitle>
          </SheetHeader>
          <nav className="grid gap-6 text-lg font-medium">
            {navItems.map((item) => (
              <SheetClose asChild key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-4 px-2.5 ${pathname === item.href
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </SheetClose>
            ))}
            {(userRole === 'admin' || userRole === 'superadmin') && (
              <SheetClose asChild key='/settings'>
                <Link
                  href='/settings'
                  className={`flex items-center gap-4 px-2.5 ${pathname === '/settings'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Settings className="h-5 w-5" />
                  Configurações
                </Link>
              </SheetClose>
            )}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="relative ml-auto flex items-center gap-2">
        <ConnectionStatusBadge />
        <VersionBadge prefix="v" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {mounted && unreadCount > 0 && (
                <Badge className="absolute top-0 right-0 h-4 w-4 shrink-0 rounded-full p-0 flex items-center justify-center text-xs">
                  {unreadCount}
                </Badge>
              )}
              <span className="sr-only">Notificações</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "flex flex-col items-start gap-1 cursor-pointer",
                    !notification.isRead && "bg-accent/50"
                  )}
                  onClick={() => {
                    if (!notification.isRead) {
                      markAsRead(notification.id);
                    }
                    if (notification.linkTo) {
                      router.push(notification.linkTo);
                    }
                  }}
                >
                  <div className="flex justify-between items-start w-full">
                    <p className="font-semibold text-sm">{notification.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{notification.message}</p>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="overflow-hidden rounded-full"
            >
              <Avatar>
                <AvatarImage src={session?.userData?.avatarUrl || ''} alt={`Avatar de ${userName}`} />
                <AvatarFallback>{userName?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {userEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">
                <User className="mr-2 h-4 w-4" />
                <span>Minha Conta</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/releases">
                <FileClock className="mr-2 h-4 w-4" />
                <span>Lançamentos</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/roadmap">
                <Rocket className="mr-2 h-4 w-4" />
                <span>Roadmap</span>
              </Link>
            </DropdownMenuItem>
            {isSuperAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/super-admin">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  <span>Super Admin</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuGroup>
              <DropdownMenuLabel>Tema</DropdownMenuLabel>
              <div className="flex justify-around p-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTheme('light')}
                >
                  <Sun className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTheme('dark')}
                >
                  <Moon className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTheme('system')}
                >
                  <Laptop className="h-4 w-4" />
                </Button>
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut} className="text-destructive focus:text-destructive cursor-pointer">
              {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
              <span>{isLoggingOut ? 'A Sair...' : 'Sair'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
