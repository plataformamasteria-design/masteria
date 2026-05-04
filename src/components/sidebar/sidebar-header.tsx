'use client';

import Link from 'next/link';
import { BotMessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarHeaderProps {
    expanded: boolean;
    isMobile: boolean;
    onMobileClose?: () => void;
}

export function SidebarHeader({ expanded, isMobile, onMobileClose }: SidebarHeaderProps) {
    return (
        <>
            <div className={cn(
                "flex h-16 items-center shrink-0",
                expanded ? "px-5" : "justify-center"
            )}>
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2.5 outline-none"
                    onClick={isMobile && onMobileClose ? onMobileClose : undefined}
                >
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative"
                    >
                        <BotMessageSquare className="h-7 w-7 text-primary glow-primary saturate-150" />
                    </motion.div>

                    <AnimatePresence>
                        {expanded && (
                            <motion.span
                                initial={{ opacity: 0, width: 0, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, width: 'auto', filter: 'blur(0px)' }}
                                exit={{ opacity: 0, width: 0, filter: 'blur(4px)' }}
                                className="font-bold text-[15px] tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent truncate block"
                            >
                                Master IA
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Link>
            </div>

            <div className="sidebar-separator mx-3" />
        </>
    );
}
