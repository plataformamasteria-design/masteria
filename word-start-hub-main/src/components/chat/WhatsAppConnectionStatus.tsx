import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useMultiWhatsApp } from '@/hooks/useMultiWhatsApp';
import { useOrganization } from '@/contexts/OrganizationContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ConnectionsTab from '@/components/settings/ConnectionsTab';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

export function WhatsAppConnectionStatus() {
  const { currentOrganization } = useOrganization();
  const { connections, isLoading } = useMultiWhatsApp();
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false);
  const [hasGlobalConfig, setHasGlobalConfig] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);

  useEffect(() => {
    checkGlobalConfig();
  }, [currentOrganization]);

  const checkGlobalConfig = async () => {
    if (!currentOrganization?.id) {
      setCheckingConfig(false);
      return;
    }

    setCheckingConfig(true);
    try {
      const { data: globalConfig } = await supabase
        .from('global_config')
        .select('key, value')
        .eq('key', 'evolution_api_url');

      const hasUrl = globalConfig?.some((c) => c.key === 'evolution_api_url' && c.value);

      if (hasUrl) {
        setHasGlobalConfig(true);
      } else {
        setHasGlobalConfig(false);
      }
    } catch (error) {
      console.error('Error checking global config:', error);
      setHasGlobalConfig(false);
    } finally {
      setCheckingConfig(false);
    }
  };

  if (checkingConfig) {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasGlobalConfig) {
    return null;
  }

  // Determine global status
  let overallStatus: 'all_connected' | 'some_connected' | 'all_disconnected' | 'connecting' = 'all_disconnected';

  if (connections.length > 0) {
    const openCount = connections.filter(c => c.status === 'open').length;
    const isConnecting = connections.some(c => c.status === 'connecting');

    if (openCount === connections.length) {
      overallStatus = 'all_connected';
    } else if (openCount > 0) {
      overallStatus = 'some_connected';
    } else if (isConnecting) {
      overallStatus = 'connecting';
    } else {
      overallStatus = 'all_disconnected';
    }
  }

  const getStatusColorClass = () => {
    switch (overallStatus) {
      case 'all_connected': return 'from-green-400 to-green-600 shadow-green-500/30 ring-green-500/20';
      case 'some_connected': return 'from-yellow-400 to-amber-500 shadow-yellow-500/30 ring-yellow-500/20';
      case 'connecting': return 'from-yellow-400 to-orange-500 shadow-orange-500/30 ring-orange-500/20';
      case 'all_disconnected': default: return 'from-red-400 to-red-600 shadow-red-500/30 ring-red-500/20';
    }
  };

  const statusLabel =
    overallStatus === 'all_connected' ? 'Todas conexões ativas' :
      overallStatus === 'some_connected' ? 'Algumas conexões offline' :
        overallStatus === 'connecting' ? 'Conectando...' :
          'WhatsApp desconectado';

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 hover:ring-2",
                `hover:ring-${overallStatus === 'all_connected' ? 'green' : overallStatus === 'some_connected' ? 'yellow' : 'red'}-500/20`
              )}
              disabled={isLoading}
              onClick={() => setShowConnectionsDialog(true)}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : overallStatus === 'all_connected' ? (
                <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br shadow-lg flex-shrink-0 from-green-400 to-green-600 shadow-green-500/30">
                  <Wifi className="h-3 w-3 text-white" />
                </div>
              ) : overallStatus === 'some_connected' ? (
                <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br shadow-lg flex-shrink-0 from-yellow-400 to-amber-500 shadow-yellow-500/30">
                  <Wifi className="h-3 w-3 text-white" />
                </div>
              ) : overallStatus === 'connecting' ? (
                <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br shadow-lg flex-shrink-0 from-yellow-400 to-orange-500 shadow-yellow-500/30">
                  <Loader2 className="h-3 w-3 text-white animate-spin" />
                </div>
              ) : (
                <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br shadow-lg flex-shrink-0 from-red-400 to-red-600 shadow-red-500/30">
                  <WifiOff className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {statusLabel}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={showConnectionsDialog} onOpenChange={setShowConnectionsDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-background/95 backdrop-blur-md border-border/50">
          <ConnectionsTab />
        </DialogContent>
      </Dialog>
    </>
  );
}
