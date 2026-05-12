import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GlobalModulePrice {
  id: string;
  module_key: string;
  base_price: number;
}

export interface GlobalConnectionPrice {
  id: string;
  connection_key: string;
  base_price: number;
}

export interface GlobalUserConfig {
  id: string;
  default_max_users: number;
  default_price_per_extra_user: number;
}

export function useGlobalModulePrices() {
  const [modulePrices, setModulePrices] = useState<GlobalModulePrice[]>([]);
  const [connectionPrices, setConnectionPrices] = useState<GlobalConnectionPrice[]>([]);
  const [globalUserConfig, setGlobalUserConfig] = useState<GlobalUserConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [modRes, connRes, userConfigRes] = await Promise.all([
      (supabase as any).from('global_module_prices').select('*'),
      (supabase as any).from('global_connection_prices').select('*'),
      (supabase as any).from('global_user_config').select('*').limit(1).single(),
    ]);
    setModulePrices(modRes.data || []);
    setConnectionPrices(connRes.data || []);
    setGlobalUserConfig(userConfigRes.data || null);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateModulePrice = async (moduleKey: string, basePrice: number) => {
    const { error } = await (supabase as any)
      .from('global_module_prices')
      .update({ base_price: basePrice, updated_at: new Date().toISOString() })
      .eq('module_key', moduleKey);
    if (!error) await fetchData();
    return !error;
  };

  const updateConnectionPrice = async (connectionKey: string, basePrice: number) => {
    const { error } = await (supabase as any)
      .from('global_connection_prices')
      .upsert(
        {
          connection_key: connectionKey,
          base_price: basePrice,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'connection_key' }
      );

    if (!error) await fetchData();
    return !error;
  };

  const updateGlobalUserConfig = async (config: Partial<Omit<GlobalUserConfig, 'id'>>) => {
    if (!globalUserConfig?.id) return false;
    const { error } = await (supabase as any)
      .from('global_user_config')
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq('id', globalUserConfig.id);
    if (!error) await fetchData();
    return !error;
  };

  const getModuleBasePrice = (key: string) => {
    return modulePrices.find(m => m.module_key === key)?.base_price || 0;
  };

  const getConnectionBasePrice = (key: string) => {
    return connectionPrices.find(c => c.connection_key === key)?.base_price || 0;
  };

  return {
    modulePrices,
    connectionPrices,
    globalUserConfig,
    isLoading,
    updateModulePrice,
    updateConnectionPrice,
    updateGlobalUserConfig,
    getModuleBasePrice,
    getConnectionBasePrice,
    refresh: fetchData,
  };
}
