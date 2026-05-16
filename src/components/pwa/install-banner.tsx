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
        'bg-card/95 backdrop-blur-xl',
        'border-t border-white/[0.08]',
        'shadow-[0_-8px_30px_rgba(0,0,0,0.3)]',
        'animate-in slide-in-from-bottom duration-300',
        'md:hidden'
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-semibold text-[13px] leading-tight">
                Instalar Master IA
              </p>
              <p className="text-muted-foreground text-[11px] leading-tight mt-0.5">
                Acesso rápido direto na tela inicial
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleInstall}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-[0_0_10px_hsl(161_79%_39%_/_0.2)]"
            >
              Instalar
            </Button>
            <Button
              onClick={handleDismiss}
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:bg-white/5 hover:text-foreground flex-shrink-0"
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
