
import { Suspense } from 'react';
import { ResetPasswordClient } from './reset-password-client';
import { Loader2, BotMessageSquare } from 'lucide-react';
import Link from 'next/link';

function LoadingFallback() {
    return (
        <>
            <div className="w-full min-h-screen flex items-center justify-center p-6">
                <div className="w-full max-w-md space-y-8">
                    <div className="flex justify-center">
                        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-foreground">
                            <BotMessageSquare className="h-7 w-7 text-primary" />
                            <span>Master IA Oficial</span>
                        </Link>
                    </div>
                    <div className="text-center space-y-4">
                         <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                         <p className="text-muted-foreground">A carregar...</p>
                    </div>
                </div>
            </div>
        </>
    )
}


export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
        <ResetPasswordClient />
    </Suspense>
  );
}
