'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  Settings,
  BarChart3 
} from 'lucide-react';

const navItems = [
  {
    href: '/dashboard',
    label: 'Início',
    icon: LayoutDashboard,
  },
  {
    href: '/atendimentos',
    label: 'Conversas',
    icon: MessageSquare,
  },
  {
    href: '/contacts',
    label: 'Contatos',
    icon: Users,
  },
  {
    href: '/kanban',
    label: 'Kanban',
    icon: BarChart3,
  },
  {
    href: '/settings',
    label: 'Config',
    icon: Settings,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border lg:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full',
                'text-xs font-medium transition-colors',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn(
                'h-5 w-5 mb-1',
                isActive && 'fill-primary/20'
              )} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
