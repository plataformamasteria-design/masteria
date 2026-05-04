'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FaFacebook } from 'react-icons/fa';

interface FacebookLinkBannerProps {
  userEmail: string;
}

export function FacebookLinkBanner({ userEmail }: FacebookLinkBannerProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`facebook-banner-dismissed-${userEmail}`) === 'true';
    }
    return false;
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`facebook-banner-dismissed-${userEmail}`, 'true');
    }
  };

  const handleLinkFacebook = async () => {
    setIsLoading(true);
    try {
      await signIn('facebook', {
        callbackUrl: window.location.href, // Redirects back properly
        redirect: true
      });
      // Force session update logic is handled by the redirect/reload natural to OAuth flow

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao vincular conta Facebook. Tente novamente.',
      });
      setIsLoading(false);
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="fixed bottom-6 right-6 z-[60] w-full max-w-[340px]"
      >
        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-blue-500/20 bg-blue-950/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex items-start justify-between w-full gap-4">
            <div className="flex items-start gap-3 flex-1">
              <FaFacebook className="h-5 w-5 text-[#1877F2] shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <strong className="font-semibold text-sm leading-none text-blue-100">Sincronização Master</strong>
                <span className="text-xs text-blue-200/70 leading-tight">Vincule sua conta Facebook para acessar recursos adicionais.</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleLinkFacebook}
                disabled={isLoading}
                className="whitespace-nowrap border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <FaFacebook className="mr-2 h-4 w-4 text-[#1877F2]" />
                    Conectar
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
