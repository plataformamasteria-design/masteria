import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2, Settings, Power, RefreshCw } from 'lucide-react';
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { useOrganization } from '@/contexts/OrganizationContext';
import { WhatsAppConnectDialog } from './WhatsAppConnectDialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function WhatsAppConnectionStatus() {
  const { currentOrganization } = useOrganization();
  const { status, loading, checkStatus, deleteInstance, loadingAction, updateWebhook } = useWhatsAppConnection();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [hasGlobalConfig, setHasGlobalConfig] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);

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
      // Check if global Evolution API URL is configured (API key is not readable by regular users for security)
      const { data: globalConfig } = await supabase
        .from('global_config')
        .select('key, value')
        .eq('key', 'evolution_api_url');

      const hasUrl = globalConfig?.some((c: { key: string; value: string | null }) => c.key === 'evolution_api_url' && c.value);
      
      // If URL is configured, assume the system is properly set up (API key is managed by admins)
      if (hasUrl) {
        setHasGlobalConfig(true);
        await checkStatus().catch(() => {});
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

  const handleRefresh = async () => {
    try {
      await checkStatus();
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await deleteInstance();
      await checkStatus();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const handleUpdateWebhook = async () => {
    setIsUpdatingWebhook(true);
    try {
      await updateWebhook();
    } catch (error) {
      console.error('Error updating webhook:', error);
    } finally {
      setIsUpdatingWebhook(false);
    }
  };

  // Don't show anything while checking config or if no global config
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

  const isConnected = status.connected;
  const isConnecting = status.status === 'connecting';

  return (
    <>
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                    "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20",
                    isConnected && "hover:ring-2 hover:ring-green-500/20"
                  )}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : isConnected ? (
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
                      <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30">
                        <Wifi className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  ) : isConnecting ? (
                    <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/30">
                      <Loader2 className="h-3 w-3 text-white animate-spin" />
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/30">
                      <WifiOff className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isConnected ? 'WhatsApp conectado' : isConnecting ? 'Conectando...' : 'WhatsApp desconectado'}
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="end" className="w-48">
            {isConnected ? (
              <>
                <DropdownMenuItem onClick={handleRefresh} disabled={loading}>
                  <Settings className="mr-2 h-4 w-4" />
                  Verificar status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleUpdateWebhook} disabled={isUpdatingWebhook || loadingAction}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", isUpdatingWebhook && "animate-spin")} />
                  Atualizar Webhook
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleDisconnect} 
                  disabled={loadingAction}
                  className="text-destructive focus:text-destructive"
                >
                  <Power className="mr-2 h-4 w-4" />
                  Desconectar
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => setShowConnectDialog(true)}>
                  <Wifi className="mr-2 h-4 w-4" />
                  Conectar WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRefresh} disabled={loading}>
                  <Settings className="mr-2 h-4 w-4" />
                  Verificar status
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>

      <WhatsAppConnectDialog
        open={showConnectDialog}
        onOpenChange={setShowConnectDialog}
        onConnected={() => {
          setShowConnectDialog(false);
          checkStatus();
        }}
      />
    </>
  );
}
