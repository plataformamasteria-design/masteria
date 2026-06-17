'use client';

import Link from 'next/link';
import { BotMessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { m as motion, AnimatePresence } from 'framer-motion';
import { useSidebar } from '@/contexts/sidebar-context';

interface SidebarHeaderProps {
    expanded: boolean;
    isMobile: boolean;
    onMobileClose?: () => void;
}

export function SidebarHeader({ expanded, isMobile, onMobileClose }: SidebarHeaderProps) {
    const { isPinned, setPinned, setExpanded } = useSidebar();

    const handlePinToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const nextPin = !isPinned;
        setPinned(nextPin);
        if (nextPin) setExpanded(true);
        // Não force setExpanded(false) imediatamente se o mouse estiver em cima
    };

    return (
        <>
            <div className={cn(
                "flex h-20 items-center shrink-0 mt-2",
                expanded ? "px-6" : "justify-center"
            )}>
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 font-bold text-xl outline-none"
                    onClick={isMobile && onMobileClose ? onMobileClose : undefined}
                >
                    <BotMessageSquare className="h-7 w-7 text-primary shrink-0" />

                    <AnimatePresence>
                        {expanded && (
                            <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                className="truncate block ml-1 text-foreground"
                            >
                                Master IA
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Link>

                {!isMobile && expanded && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handlePinToggle}
                        className="ml-auto flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                        title={isPinned ? "Recolher menu" : "Fixar menu"}
                    >
                        {isPinned ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                    </motion.button>
                )}
            </div>

            <div className="mx-6 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-80 mb-4 mt-2" />
        </>
    );
}
