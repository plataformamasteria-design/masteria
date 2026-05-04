'use client';

import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/contexts/sidebar-context';
import { useResponsive } from '@/hooks/useResponsive';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function MobileMenuButton() {
    const { toggleMobile, isMobileOpen } = useSidebar();
    const { isMobile } = useResponsive();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !isMobile) return null;

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobile}
            className="md:hidden fixed top-3 left-3 z-[60] bg-background/60 backdrop-blur-xl border border-white/[0.05] shadow-2xl overflow-hidden"
        >
            <AnimatePresence mode="wait">
                {isMobileOpen ? (
                    <motion.div
                        key="close"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <X className="h-5 w-5 text-foreground" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="menu"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Menu className="h-5 w-5 text-foreground" />
                    </motion.div>
                )}
            </AnimatePresence>
        </Button>
    );
}
