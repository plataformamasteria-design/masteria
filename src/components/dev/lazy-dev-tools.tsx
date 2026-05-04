'use client';

import dynamic from 'next/dynamic';

// Lazy-load em client component — não bloqueia compilação inicial do layout
const ConsoleMonitor = dynamic(
    () => import('@/components/dev/console-monitor').then(m => m.ConsoleMonitor),
    { ssr: false }
);
const InstallBanner = dynamic(
    () => import('@/components/pwa/install-banner').then(m => m.InstallBanner),
    { ssr: false }
);

export function LazyDevTools() {
    return (
        <>
            <ConsoleMonitor />
            <InstallBanner />
        </>
    );
}
