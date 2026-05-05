'use client';

import { useSidebar } from '@/contexts/sidebar-context';
import { useSession } from '@/contexts/session-context';
import { useResponsive } from '@/hooks/useResponsive';
import { SidebarHeader } from './sidebar-header';
import { SidebarFooter } from './sidebar-footer';
import { NavItemGroup, NavItemLink } from './sidebar-item';
import { allNavItems } from './navigation';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function SidebarLayout() {
    const { isExpanded, setExpanded, isPinned, setPinned, isMobileOpen, setMobileOpen } = useSidebar();
    const { session, loading } = useSession();
    const { isMobile } = useResponsive();
    const pathname = usePathname();

    const userRole = session?.userData?.role;
    const userEmail = session?.userData?.email;

    const userPermissions = session?.userData?.permissions as { tabs?: Record<string, boolean> } | undefined;

    const navItems = allNavItems.filter(item => {
        if (!userRole) return false;
        if (item.requireEmail && item.requireEmail !== userEmail) return false;
        
        // Se for atendente, a lógica de permissões sobrepõe as roles padrão
        if (userRole === 'atendente') {
            if (userPermissions?.tabs) {
                const isTabEnabled = userPermissions.tabs[item.label];
                if (isTabEnabled === true) return true;
                if (isTabEnabled === false) return false;
            }
            // Se não especificado, segue a role padrão
            return item.roles.includes(userRole as any);
        }
        
        return item.roles.includes(userRole as any);
    });

    const [openGroups, setOpenGroups] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (navItems.length > 0) {
            const activeGroups = navItems
                .filter(item => item.isGroup && item.subItems.some((sub: any) => sub.href && pathname.startsWith(sub.href)))
                .map(item => item.label);

            if (activeGroups.length > 0 && activeGroups[0]) {
                setOpenGroups([activeGroups[0]]);
            }
        }
    }, [pathname, navItems.length]);

    const handleGroupToggle = (label: string, isOpen: boolean) => {
        setOpenGroups(isOpen ? [label] : prev => prev.filter(l => l !== label));
    };

    useEffect(() => { if (isMobile) setExpanded(true); }, [isMobile, setExpanded]);
    useEffect(() => { if (isMobile) setMobileOpen(false); }, [pathname, isMobile, setMobileOpen]);

    const handleMouseEnter = () => { if (!isMobile && !isPinned) setExpanded(true); };
    const handleMouseLeave = () => { if (!isMobile && !isPinned) setExpanded(false); };
    const handlePinToggle = () => {
        const nextPin = !isPinned;
        setPinned(nextPin);
        if (nextPin) setExpanded(true);
    };

    const handleMobileClose = () => setMobileOpen(false);

    const renderContent = (forMobile: boolean) => {
        const expanded = forMobile ? true : isExpanded;
        return (
            <div className="flex h-full flex-col backdrop-blur-3xl bg-sidebar-bg/95">
                <SidebarHeader expanded={expanded} isMobile={isMobile} onMobileClose={handleMobileClose} />

                <nav className="flex flex-col gap-1 px-3 py-4 items-center w-full flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        [...Array(8)].map((_, i) => (
                            <div key={i} className={cn('flex h-[42px] items-center justify-start rounded-xl', expanded ? 'w-full px-3' : 'w-[42px] justify-center')}>
                                <Skeleton className={cn("h-full rounded-xl opacity-20", expanded ? "w-full" : "w-8")} />
                            </div>
                        ))
                    ) : (
                        <AnimatePresence>
                            {navItems.map((item, index) => (
                                <motion.div
                                    key={item.label}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05, duration: 0.3 }}
                                    className="w-full"
                                >
                                    {item.isGroup ? (
                                        <NavItemGroup
                                            item={item as any}
                                            isExpanded={expanded}
                                            isOpen={openGroups.includes(item.label)}
                                            onToggle={(isOpen) => handleGroupToggle(item.label, isOpen)}
                                        />
                                    ) : (
                                        <div onClick={forMobile ? handleMobileClose : undefined}>
                                            <NavItemLink item={item as any} isExpanded={expanded} />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </nav>

                <SidebarFooter expanded={expanded} isMobile={isMobile} isPinned={isPinned} onPinToggle={handlePinToggle} onMobileClose={handleMobileClose} />
            </div>
        );
    };

    if (!mounted) return null;

    return (
        <>
            {/* Spacer for Desktop Layout Reflow */}
            <div className={cn("h-screen flex-shrink-0 relative hidden md:flex ease-out", isExpanded ? "w-64" : "w-16")} />

            {/* Fixed Desktop Sidebar */}
            <motion.aside
                layout
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                initial={false}
                animate={{ width: isExpanded ? 256 : 64 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className={cn(
                    "fixed left-0 top-0 z-[50] h-screen border-r border-sidebar-border hidden md:flex flex-col shadow-2xl overflow-hidden",
                    isExpanded ? "w-64" : "w-16"
                )}
            >
                {renderContent(false)}
            </motion.aside>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobile && isMobileOpen && (
                    <div className="fixed inset-0 z-[60] md:hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileOpen(false)}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        />
                        <motion.aside
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            className="absolute left-0 top-0 h-screen w-[280px] border-r border-sidebar-border shadow-2xl bg-sidebar-bg"
                        >
                            {renderContent(true)}
                        </motion.aside>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
