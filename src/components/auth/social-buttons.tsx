'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';

export function SocialButtons() {
    const { toast } = useToast();
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isFacebookLoading, setIsFacebookLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [availableProviders, setAvailableProviders] = useState<{ google: boolean; facebook: boolean }>({
        google: false,
        facebook: false,
    });

    useEffect(() => {
        setIsMounted(true);
        fetch('/api/auth/providers-status')
            .then(res => res.json())
            .then(data => setAvailableProviders(data))
            .catch(() => setAvailableProviders({ google: false, facebook: false }));
    }, []);

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        try {
            await signIn('google', { callbackUrl: '/api/auth/oauth-callback?redirect=/dashboard' });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Falha ao fazer login com Google',
            });
            setIsGoogleLoading(false);
        }
    };

    const handleFacebookSignIn = async () => {
        setIsFacebookLoading(true);
        try {
            await signIn('facebook', { callbackUrl: '/api/auth/oauth-callback?redirect=/dashboard' });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Falha ao fazer login com Facebook',
            });
            setIsFacebookLoading(false);
        }
    };

    if (!isMounted || (!availableProviders.google && !availableProviders.facebook)) {
        return null;
    }

    return (
        <>
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                        Ou continue com
                    </span>
                </div>
            </div>

            <div className={`grid gap-4 ${availableProviders.google && availableProviders.facebook ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {availableProviders.google && (
                    <Button
                        variant="outline"
                        type="button"
                        disabled={isGoogleLoading || isFacebookLoading}
                        onClick={handleGoogleSignIn}
                        className="w-full"
                    >
                        {isGoogleLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FcGoogle className="mr-2 h-5 w-5" />
                        )}
                        Google
                    </Button>
                )}
                {availableProviders.facebook && (
                    <Button
                        variant="outline"
                        type="button"
                        disabled={isGoogleLoading || isFacebookLoading}
                        onClick={handleFacebookSignIn}
                        className="w-full"
                    >
                        {isFacebookLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FaFacebook className="mr-2 h-5 w-5 text-[#1877F2]" />
                        )}
                        Facebook
                    </Button>
                )}
            </div>
        </>
    );
}
