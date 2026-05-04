'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// Zero Any Policy - Strict typing
export interface SidebarContextType {
    isExpanded: boolean;
    setExpanded: (expanded: boolean) => void;
    isPinned: boolean;
    setPinned: (pinned: boolean) => void;
    isMobileOpen: boolean;
    setMobileOpen: (open: boolean) => void;
    toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isExpanded, setExpanded] = useState(true);
    const [isPinned, setPinned] = useState(true);
    const [isMobileOpen, setMobileOpen] = useState(false);

    const toggleMobile = () => setMobileOpen(!isMobileOpen);

    useEffect(() => {
        if (isMobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileOpen]);

    return (
        <SidebarContext.Provider
            value={{
                isExpanded,
                setExpanded,
                isPinned,
                setPinned,
                isMobileOpen,
                setMobileOpen,
                toggleMobile
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar(): SidebarContextType {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
