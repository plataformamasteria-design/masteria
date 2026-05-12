import { useState, useCallback } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionStatus {
  status: 'open' | 'close' | 'connecting' | 'not_found' | 'error' | 'unknown';
  connected: boolean;
}

interface ConnectionData {
  qrcode?: string;
  pairingCode?: string;
}

export function useWhatsAppConnection() {
  const { currentOrganization } = useOrganization();
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>({ status: 'unknown', connected: false });
  const [connectionData, setConnectionData] = useState<ConnectionData | null>(null);

  const callEvolutionApi = useCallback(async (action: string, body?: Record<string, unknown>) => {
    if (!currentOrganization?.id) {
      throw new Error('Organization not found');
    }

    const payload = {
      action,
      organization_id: currentOrganization.id,
      ...(body || {}),
    };

    const { data, error } = await supabase.functions.invoke('evolution-api', {
      body: payload,
    });

    if (error) {
      // supabase.functions.invoke wraps non-2xx as FunctionsHttpError
      const message = data?.error || error.message || 'API call failed';
      throw new Error(message);
    }

    return data;
  }, [currentOrganization?.id]);

  // Silent version of checkStatus for polling - doesn't affect loading state
  const checkStatusSilent = useCallback(async () => {
    if (!currentOrganization?.id) return null;

    try {
      const data = await callEvolutionApi('status');
      setStatus({
        status: data.status,
        connected: data.connected,
      });
      return data;
    } catch (error) {
      console.error('Error checking status:', error);
      setStatus({ status: 'error', connected: false });
      return null;
    }
  }, [currentOrganization?.id, callEvolutionApi]);

  const checkStatus = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoadingStatus(true);
    try {
      const data = await callEvolutionApi('status');
      setStatus({
        status: data.status,
        connected: data.connected,
      });
      return data;
    } catch (error) {
      console.error('Error checking status:', error);
      setStatus({ status: 'error', connected: false });
      throw error;
    } finally {
      setLoadingStatus(false);
    }
  }, [currentOrganization?.id, callEvolutionApi]);

  const createInstance = useCallback(async (phoneNumber?: string) => {
    if (!currentOrganization?.id) return;

    setLoadingAction(true);
    try {
      const data = await callEvolutionApi('create', { phoneNumber });
      
      if (data.qrcode) {
        setConnectionData({ qrcode: data.qrcode });
      }
      
      setStatus({ status: 'connecting', connected: false });
      
      toast({
        title: 'Instância criada',
        description: 'Escaneie o QR Code para conectar',
      });
      
      return data;
    } catch (error) {
      console.error('Error creating instance:', error);
      const message = error instanceof Error ? error.message : 'Falha ao criar instância';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoadingAction(false);
    }
  }, [currentOrganization?.id, callEvolutionApi]);

  const reconnect = useCallback(async (phoneNumber?: string) => {
    if (!currentOrganization?.id) return;

    setLoadingAction(true);
    try {
      const data = await callEvolutionApi('reconnect', { phoneNumber });
      
      if (data.qrcode) {
        setConnectionData({ qrcode: data.qrcode });
      }
      
      setStatus({ status: 'connecting', connected: false });
      
      toast({
        title: 'Reconectando',
        description: 'Escaneie o QR Code para conectar',
      });
      
      return data;
    } catch (error) {
      console.error('Error reconnecting:', error);
      const message = error instanceof Error ? error.message : 'Falha ao reconectar';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoadingAction(false);
    }
  }, [currentOrganization?.id, callEvolutionApi]);

  const getQRCode = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoadingAction(true);
    try {
      const data = await callEvolutionApi('connect');
      setConnectionData({
        qrcode: data.qrcode,
        pairingCode: data.pairingCode,
      });
      return data;
    } catch (error) {
      console.error('Error getting QR code:', error);
      throw error;
    } finally {
      setLoadingAction(false);
    }
  }, [currentOrganization?.id, callEvolutionApi]);

  const getPairingCode = useCallback(async (phoneNumber: string) => {
    if (!currentOrganization?.id) return;

    setLoadingAction(true);
    try {
      const data = await callEvolutionApi('pairing-code', { phoneNumber });
      
      if (data.error && !data.pairingCode) {
        toast({
          title: 'Código não disponível',
          description: 'Use o QR Code para conectar',
          variant: 'destructive',
        });
        return data;
      }
      
      setConnectionData(prev => ({
        ...prev,
        pairingCode: data.pairingCode,
      }));
      return data;
    } catch (error) {
      console.error('Error getting pairing code:', error);
      const message = error instanceof Error ? error.message : 'Falha ao obter código de pareamento';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoadingAction(false);
    }
  }, [currentOrganization?.id, callEvolutionApi]);

  const deleteInstance = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoadingAction(true);
    try {
      await callEvolutionApi('delete');
      setStatus({ status: 'close', connected: false });
      setConnectionData(null);
      
      toast({
        title: 'Desconectado',
        description: 'Instância removida com sucesso',
      });
    } catch (error) {
      console.error('Error deleting instance:', error);
      const message = error instanceof Error ? error.message : 'Falha ao desconectar';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoadingAction(false);
    }
  }, [currentOrganization?.id, callEvolutionApi]);

  const clearConnectionData = useCallback(() => {
    setConnectionData(null);
  }, []);

  const updateWebhook = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoadingAction(true);
    try {
      const data = await callEvolutionApi('update-webhook');
      
      toast({
        title: 'Webhook atualizado',
        description: 'Webhook configurado para receber mensagens nativamente',
      });
      
      return data;
    } catch (error) {
      console.error('Error updating webhook:', error);
      const message = error instanceof Error ? error.message : 'Falha ao atualizar webhook';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoadingAction(false);
    }
  }, [currentOrganization?.id, callEvolutionApi]);

  const getWebhookInfo = useCallback(async () => {
    if (!currentOrganization?.id) return null;

    try {
      const data = await callEvolutionApi('get-webhook');
      return data;
    } catch (error) {
      console.error('Error getting webhook info:', error);
      return null;
    }
  }, [currentOrganization?.id, callEvolutionApi]);

  return {
    loading: loadingAction, // For backwards compatibility
    loadingAction,
    loadingStatus,
    status,
    connectionData,
    checkStatus,
    checkStatusSilent,
    createInstance,
    reconnect,
    getQRCode,
    getPairingCode,
    deleteInstance,
    clearConnectionData,
    updateWebhook,
    getWebhookInfo,
  };
}
