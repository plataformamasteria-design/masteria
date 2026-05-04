'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { NavItemSingle, NavItemGroupData } from './navigation';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

export function NavItemLink({ item, isExpanded }: { item: NavItemSingle; isExpanded: boolean }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const isActive = () => {
        if (!item.href) return false;
        const pathMatches = pathname === item.href;
        if (!item.query) {
            return pathMatches && !searchParams.has('tab');
        }
        return pathMatches && Object.entries(item.query).every(([key, value]) => searchParams.get(key) === value);
    };
    const active = isActive();
    const linkHref = item.query ? `${item.href}?${new URLSearchParams(item.query as any).toString()}` : item.href;

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <Link href={linkHref} className="block w-full">
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                                'group relative flex h-[42px] items-center rounded-xl text-muted-foreground transition-colors duration-200',
                                isExpanded ? 'w-full px-3' : 'w-[42px] justify-center mx-auto',
                                active ? 'text-primary font-medium bg-primary/10 border border-primary/20' : 'hover:bg-white/[0.04]',
                                'min-w-0'
                            )}
                        >
                            {active && (
                                <motion.span
                                    layoutId="active-indicator"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full shadow-[0_0_8px_hsl(var(--primary)_/_40%)]"
                                />
                            )}
                            <item.icon className={cn(
                                "h-[18px] w-[18px] flex-shrink-0 transition-all duration-300",
                                active ? "text-primary saturate-150 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "group-hover:text-foreground"
                            )} strokeWidth={1.8} />

                            <AnimatePresence mode="popLayout">
                                {isExpanded && (
                                    <motion.span
                                        initial={{ opacity: 0, filter: 'blur(4px)' }}
                                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                                        exit={{ opacity: 0, filter: 'blur(4px)' }}
                                        transition={{ duration: 0.3 }}
                                        className={cn(
                                            "ml-3 truncate flex-1 min-w-0 text-left text-[14px]",
                                            active ? "font-semibold tracking-tight text-foreground" : "font-medium"
                                        )}
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </Link>
                </TooltipTrigger>
                {!isExpanded && (
                    <TooltipContent side="right" className="bg-card/95 backdrop-blur-md border-white/5 shadow-2xl text-sm font-medium">
                        {item.label}
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
}

export function NavItemGroup({
    item,
    isExpanded,
    isOpen,
    onToggle
}: {
    item: NavItemGroupData;
    isExpanded: boolean;
    isOpen: boolean;
    onToggle: (open: boolean) => void;
}) {
    const pathname = usePathname();
    const isChildActive = item.subItems.some(sub => sub.href && pathname.startsWith(sub.href));

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={onToggle}
            className="w-full"
        >
            <TooltipProvider>
                <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                        <CollapsibleTrigger asChild>
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                    'group flex h-[42px] cursor-pointer items-center justify-between rounded-xl text-muted-foreground transition-all duration-200',
                                    isExpanded ? 'w-full px-3' : 'w-[42px] justify-center mx-auto',
                                    isChildActive && 'text-foreground font-semibold',
                                    isOpen && isExpanded && 'bg-white/[0.03]',
                                    !isOpen && 'hover:bg-white/[0.04]',
                                    'min-w-0'
                                )}
                            >
                                <div className={cn("flex items-center min-w-0 w-full", isExpanded ? "flex-1" : "justify-center")}>
                                    <item.icon className={cn(
                                        "h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200",
                                        isChildActive ? "text-primary saturate-150" : "group-hover:text-foreground"
                                    )} strokeWidth={1.8} />

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.span
                                                initial={{ opacity: 0, filter: 'blur(4px)' }}
                                                animate={{ opacity: 1, filter: 'blur(0px)' }}
                                                exit={{ opacity: 0, filter: 'blur(4px)' }}
                                                className={cn("ml-3 truncate flex-1 text-left text-[14px]", isChildActive ? "font-semibold tracking-tight" : "font-medium")}
                                            >
                                                {item.label}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                                {isExpanded && (
                                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
                                    </motion.div>
                                )}
                            </motion.div>
                        </CollapsibleTrigger>
                    </TooltipTrigger>
                    {!isExpanded && (
                        <TooltipContent side="right" className="bg-card/95 backdrop-blur-md border-white/5 shadow-2xl text-sm font-medium">
                            {item.label}
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>

            <CollapsibleContent className="overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                        "flex flex-col gap-1 py-1 mt-1",
                        isExpanded ? "pl-[22px] ml-[10px] border-l border-white/[0.05]" : "items-center"
                    )}
                >
                    {item.subItems.map((subItem) => (
                        <NavItemLink
                            key={subItem.href + (subItem.query ? `?tab=${subItem.query.tab}` : '')}
                            item={{ ...subItem, isGroup: false, icon: item.icon } as any}
                            isExpanded={isExpanded}
                        />
                    ))}
                </motion.div>
            </CollapsibleContent>
        </Collapsible>
    );
}
