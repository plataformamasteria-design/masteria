// src/app/(main)/gallery/page.tsx
import { GalleryClient } from '@/components/gallery/gallery-client';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function GalleryPage() {
  return (
    <div className="space-y-6">
        <Suspense fallback={<LoadingSkeleton />}>
            <GalleryClient />
        </Suspense>
    </div>
  );
}
