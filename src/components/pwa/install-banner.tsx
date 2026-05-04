'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DISMISSAL_KEY = 'pwa-install-banner-dismissed';
const DISMISSAL_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallBanner() {
  const { isInstallable, installPWA } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const dismissedAt = localStorage.getItem(DISMISSAL_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const now = Date.now();
      
      if (now - dismissedTime < DISMISSAL_DURATION) {
        setIsVisible(false);
        return;
      }
    }
    
    setIsVisible(isInstallable);
  }, [isInstallable]);

  const handleInstall = async () => {
    await installPWA();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!isMounted || !isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-gradient-to-r from-emerald-500 to-emerald-600',
        'border-t border-emerald-400',
        'shadow-lg',
        'animate-in slide-in-from-bottom duration-300',
        'md:hidden'
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">
                Instalar Master IA
              </p>
              <p className="text-white/90 text-xs leading-tight mt-0.5">
                Acesso rápido direto na tela inicial
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleInstall}
              size="sm"
              className="bg-white text-emerald-600 hover:bg-white/90 font-semibold shadow-sm"
            >
              Instalar
            </Button>
            <Button
              onClick={handleDismiss}
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/10 flex-shrink-0"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Fechar</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
