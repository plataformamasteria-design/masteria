import {
    BotMessageSquare,
    LayoutDashboard,
    Send,
    MessageSquareText,
    Users,
    Settings,
    MessagesSquare,
    Plug,
    ClipboardList,
    GalleryVertical,
    MessageCircle,
    Tags,
    GitBranch,
    Kanban,
    Building2,
    Megaphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type RoleAllowed = 'admin' | 'atendente' | 'superadmin' | string;

export interface NavLinkParams {
    tab?: string;
    [key: string]: string | undefined;
}

export type NavItemBase = {
    label: string;
    icon: LucideIcon;
    roles: RoleAllowed[];
    requireEmail?: string;
};

export type NavItemSingle = NavItemBase & {
    isGroup?: false;
    href: string;
    query?: NavLinkParams;
};

export type NavItemGroupData = NavItemBase & {
    isGroup: true;
    subItems: Array<{ href: string; label: string; query?: NavLinkParams }>;
};

export type NavItem = NavItemSingle | NavItemGroupData;

export const allNavItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'atendente', 'superadmin'] },
    { href: '/atendimentos', label: 'Atendimentos', icon: MessagesSquare, roles: ['admin', 'atendente', 'superadmin'] },
    { href: '/equipes', label: 'Equipes', icon: Users, roles: ['admin', 'superadmin'] },
    { href: '/contacts', label: 'Contatos', icon: Users, roles: ['admin', 'atendente', 'superadmin'] },
    { href: '/lists', label: 'Listas', icon: ClipboardList, roles: ['admin', 'atendente', 'superadmin'] },
    { href: '/tags', label: 'Tags', icon: Tags, roles: ['admin', 'superadmin'] },
    { href: '/kanban', label: 'Pipeline Kanban', icon: Kanban, roles: ['admin', 'superadmin'] },
    { href: '/campanhas', label: 'Campanhas', icon: Send, roles: ['admin', 'superadmin'] },
    { href: '/marketing', label: 'Marketing', icon: Megaphone, roles: ['admin', 'superadmin'] },
    { href: '/automacoes', label: 'Automações', icon: GitBranch, roles: ['admin', 'superadmin'] },
    { href: '/conexoes', label: 'Conexões', icon: Plug, roles: ['admin', 'superadmin'] },
    { href: '/admin/organizations', label: 'Organizações', icon: Building2, roles: ['superadmin'], requireEmail: 'superadmin@admin.com' },
];
