'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

export function useLoginFlow() {
    const router = useRouter();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const errorKey = searchParams.get('error');
    const { status } = useSession();

    useEffect(() => {
        // [FEATURE] Frontend Session Reactivation & Loop Prevention
        if (status === 'authenticated') {
            // CRITICAL: If backend rejected session (token_nao_encontrado), trust backend and kill frontend session.
            // This breaks the infinite loop: Login -> Dashboard -> No Cookie -> Login -> Authenticated -> Dashboard...
            if (errorKey === 'token_nao_encontrado' || errorKey === 'token_invalido') {
                console.warn('[Login] Mismatch detected: Frontend authenticated but Backend rejected. Forcing logout.');

                signOut({ redirect: false }).then(() => {
                    toast({
                        variant: 'default',
                        title: 'Sincronizando Sessão',
                        description: 'Detectamos um problema na sessão. Por favor, faça login novamente.'
                    });
                    // Remove error from URL to verify clean state
                    router.replace('/login');
                });
                return; // Stop execution to prevent dashboard redirect
            }

            // [FEATURE] Frontend Session Reactivation
            // Only redirect if authenticated AND NO critical errors are present
            if (!errorKey) {
                toast({
                    title: "Sessão Ativa",
                    description: "Você já está logado. Redirecionando para o painel..."
                });
                router.push('/dashboard');
            }
        }
    }, [status, router, toast, errorKey]);

    return { errorKey };
}
