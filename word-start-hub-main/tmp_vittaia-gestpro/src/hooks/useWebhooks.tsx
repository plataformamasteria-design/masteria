import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface Webhook {
  id: string;
  name: string;
  url: string;
  webhook_type: string;
  active: boolean;
  headers?: any;
  organization_id: string;
}

export const useWebhooks = (webhookType: 'sent' | 'follow_up') => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  const fetchWebhooks = useCallback(async () => {
    if (!currentOrganization?.id) {
      console.log(`[useWebhooks] Aguardando organização para buscar webhooks do tipo: ${webhookType}`);
      setWebhooks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log(`[useWebhooks] Buscando webhooks do tipo: ${webhookType} para organização: ${currentOrganization.id}`);
    
    const { data, error } = await (supabase as any)
      .from('webhook_configs')
      .select('*')
      .eq('webhook_type', webhookType)
      .eq('active', true)
      .eq('organization_id', currentOrganization.id);

    if (error) {
      console.error('[useWebhooks] Erro ao buscar webhooks:', error);
      setWebhooks([]);
    } else {
      console.log(`[useWebhooks] Webhooks encontrados (${webhookType}):`, data?.length || 0, data);
      setWebhooks(data || []);
    }
    setLoading(false);
  }, [webhookType, currentOrganization?.id]);

  useEffect(() => {
    fetchWebhooks();

    // Realtime subscription para webhooks
    const channel = supabase
      .channel(`webhook-changes-${webhookType}-${currentOrganization?.id || 'none'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webhook_configs',
        },
        (payload) => {
          console.log('[useWebhooks] Webhook alterado, recarregando...', payload);
          fetchWebhooks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [webhookType, currentOrganization?.id, fetchWebhooks]);

  return { webhooks, loading, refetch: fetchWebhooks };
};
