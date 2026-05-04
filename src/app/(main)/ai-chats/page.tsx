
// src/app/(main)/ai-chats/page.tsx
'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AiPlayground } from '@/components/ai/ai-playground';

function LoadingSkeleton() {
    return (
        <div className="grid grid-cols-[280px_1fr] h-full gap-4" style={{ height: 'calc(100vh - 7rem)' }}>
            <div className="space-y-2 bg-muted/50 p-2 rounded-lg">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
            <div className="border rounded-lg flex flex-col">
                <div className="p-3 border-b flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                </div>
                <div className="flex-1 p-4" />
                <div className="p-4 border-t">
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        </div>
    )
}

export default function AiChatsPage() {
    return (
        <div className="h-full flex flex-col">
            <Suspense fallback={<LoadingSkeleton />}>
                <AiPlayground />
            </Suspense>
        </div>
    )
}
