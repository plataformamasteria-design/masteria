'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { m as motion, AnimatePresence } from 'framer-motion';
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
                                'group relative flex h-[46px] items-center rounded-2xl text-muted-foreground transition-all duration-300 mx-2',
                                isExpanded ? 'px-4' : 'w-[46px] justify-center mx-auto',
                                active ? 'text-foreground dark:text-white font-bold bg-black/5 dark:bg-black/40 backdrop-blur-md border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15),inset_0_0_15px_rgba(16,185,129,0.1)]' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-foreground dark:hover:text-white border border-transparent hover:shadow-[0_0_15px_rgba(0,0,0,0.02)] dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.02)] hover:border-black/[0.05] dark:hover:border-white/[0.05]',
                                'min-w-0'
                            )}
                        >
                            {active && (
                                <motion.div
                                    layoutId="active-bg-glow"
                                    className="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-xl -z-10"
                                />
                            )}
                            <item.icon className={cn(
                                "h-[20px] w-[20px] flex-shrink-0 transition-all duration-300",
                                active ? "text-emerald-500 dark:text-emerald-400 saturate-200 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)] dark:drop-shadow-[0_0_12px_rgba(16,185,129,0.8)] scale-110" : "group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(0,0,0,0.2)] dark:group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                            )} strokeWidth={1.8} />

                            <AnimatePresence mode="popLayout">
                                {isExpanded && (
                                    <motion.span
                                        initial={{ opacity: 0, filter: 'blur(4px)' }}
                                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                                        exit={{ opacity: 0, filter: 'blur(4px)' }}
                                        transition={{ duration: 0.3 }}
                                        className={cn(
                                            "ml-3 truncate flex-1 min-w-0 text-left text-[14px] transition-transform duration-300 group-hover:translate-x-1",
                                            active ? "font-bold tracking-tight text-foreground dark:text-white" : "font-medium"
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
                    <TooltipContent side="right" className="bg-card/95 backdrop-blur-md border-border/50 shadow-2xl text-sm font-medium">
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
                                    'group flex h-[46px] cursor-pointer items-center justify-between rounded-2xl text-muted-foreground transition-all duration-300 mx-2',
                                    isExpanded ? 'px-4' : 'w-[46px] justify-center mx-auto',
                                    isChildActive ? 'text-foreground dark:text-white font-bold bg-black/5 dark:bg-black/20 border border-emerald-500/20 shadow-[inset_0_0_10px_rgba(16,185,129,0.05)]' : 'hover:text-foreground dark:hover:text-white',
                                    !isChildActive && isOpen && isExpanded ? 'bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5' : 'border border-transparent',
                                    !isOpen && !isChildActive && 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:border-black/[0.05] dark:hover:border-white/[0.05]',
                                    'min-w-0'
                                )}
                            >
                                <div className={cn("flex items-center min-w-0 w-full", isExpanded ? "flex-1" : "justify-center")}>
                                    <item.icon className={cn(
                                        "h-[20px] w-[20px] flex-shrink-0 transition-all duration-300",
                                        isChildActive ? "text-emerald-500 dark:text-emerald-400 saturate-200 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)] dark:drop-shadow-[0_0_12px_rgba(16,185,129,0.8)] scale-110" : "group-hover:text-zinc-800 dark:group-hover:text-zinc-100 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(0,0,0,0.2)] dark:group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                                    )} strokeWidth={1.8} />

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.span
                                                initial={{ opacity: 0, filter: 'blur(4px)' }}
                                                animate={{ opacity: 1, filter: 'blur(0px)' }}
                                                exit={{ opacity: 0, filter: 'blur(4px)' }}
                                                className={cn("ml-3 truncate flex-1 text-left text-[14px] transition-transform duration-300 group-hover:translate-x-1", isChildActive ? "font-bold tracking-tight text-foreground dark:text-white" : "font-medium")}
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
                        <TooltipContent side="right" className="bg-card/95 backdrop-blur-md border-border/50 shadow-2xl text-sm font-medium">
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
                        isExpanded ? "pl-[22px] ml-[10px] border-l border-black/[0.05] dark:border-white/[0.05]" : "items-center"
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
