import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface OrgModule {
  id: string;
  organization_id: string;
  module_key: string;
  active: boolean;
  price: number;
}

export interface OrgConnection {
  id: string;
  organization_id: string;
  connection_key: string;
  active: boolean;
  price: number;
}

// Module definitions with display info
export const MODULE_DEFINITIONS: Record<string, { label: string; description: string; features: string[] }> = {
  padrao: {
    label: 'Padrão',
    description: 'Módulo base da plataforma',
    features: [
      'Dashboard',
      'Chat',
      'Agenda (sem link e sem widget)',
      'Comandos',
      'Leads (sem ativação de robô)',
      'Relatório e Etiquetas',
      'CRM',
      'Equipe',
      'Financeiro',
      'Mensagens Automáticas',
      'Conexão WhatsApp (inclusa)',
    ],
  },
  automacao_simples: {
    label: 'Automação Simples',
    description: 'Automações por fluxo, agenda completa e disparos',
    features: [
      'Automação por Fluxo',
      'Link de Agenda e Widget',
      'Disparos em massa',
    ],
  },
  atendente_ia: {
    label: 'Atendente de I.A',
    description: 'Automação com inteligência artificial e acesso ao desenvolvedor',
    features: [
      'Automação I.A',
      'Aba Desenvolvedor',
    ],
  },
};

export const CONNECTION_DEFINITIONS: Record<string, { label: string; icon: string; native?: boolean; alwaysFree?: boolean }> = {
  whatsapp_nativo: { label: 'WhatsApp (Nativo)', icon: 'MessageCircle', native: true, alwaysFree: true },
  instagram_facebook: { label: 'Instagram + Facebook (combo)', icon: 'Instagram' },
  whatsapp_api_oficial: { label: 'WhatsApp API Oficial', icon: 'Phone' },
};

export function useOrganizationModules(orgId?: string) {
  const { currentOrganization } = useOrganization();
  const targetOrgId = orgId || currentOrganization?.id;
  const isLifetime = !!(currentOrganization as any)?.lifetime;

  const [modules, setModules] = useState<OrgModule[]>([]);
  const [connections, setConnections] = useState<OrgConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!targetOrgId) return;
    setIsLoading(true);

    const [modRes, connRes] = await Promise.all([
      (supabase as any).from('organization_modules').select('*').eq('organization_id', targetOrgId),
      (supabase as any).from('organization_connections').select('*').eq('organization_id', targetOrgId),
    ]);

    setModules(modRes.data || []);
    setConnections(connRes.data || []);
    setIsLoading(false);
  }, [targetOrgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasModule = useCallback((key: string) => {
    if (isLifetime) return true;
    return modules.some(m => m.module_key === key && m.active);
  }, [modules, isLifetime]);

  const hasConnection = useCallback((key: string) => {
    if (isLifetime) return true;
    return connections.some(c => c.connection_key === key && c.active);
  }, [connections, isLifetime]);

  const updateModule = async (moduleKey: string, data: { active?: boolean; price?: number }) => {
    const { error } = await (supabase as any)
      .from('organization_modules')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('organization_id', targetOrgId)
      .eq('module_key', moduleKey);

    if (!error) await fetchData();
    return !error;
  };

  const updateConnection = async (connectionKey: string, data: { active?: boolean; price?: number }) => {
    const { error } = await (supabase as any)
      .from('organization_connections')
      .upsert({
        organization_id: targetOrgId,
        connection_key: connectionKey,
        active: data.active ?? false,
        price: data.price ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,connection_key' });

    if (!error) await fetchData();
    return !error;
  };

  // Ensure modules/connections exist for an org (called when creating)
  const ensureDefaults = async (organizationId: string) => {
    const moduleKeys = Object.keys(MODULE_DEFINITIONS);
    const connectionKeys = Object.keys(CONNECTION_DEFINITIONS);

    for (const key of moduleKeys) {
      await (supabase as any).from('organization_modules').upsert({
        organization_id: organizationId,
        module_key: key,
        active: key === 'padrao',
        price: -1,
      }, { onConflict: 'organization_id,module_key' });
    }

    for (const key of connectionKeys) {
      await (supabase as any).from('organization_connections').upsert({
        organization_id: organizationId,
        connection_key: key,
        active: false,
        price: -1,
      }, { onConflict: 'organization_id,connection_key' });
    }
  };

  // Raw total: -1 = inherit (not calculated here without global prices), 0 = free, >0 = custom
  const totalMonthly = [...modules.filter(m => m.active), ...connections.filter(c => c.active)]
    .reduce((sum, item) => {
      const price = Number(item.price || 0);
      return sum + (price > 0 ? price : 0);
    }, 0);

  return {
    modules,
    connections,
    isLoading,
    hasModule,
    hasConnection,
    updateModule,
    updateConnection,
    ensureDefaults,
    totalMonthly,
    refresh: fetchData,
  };
}
