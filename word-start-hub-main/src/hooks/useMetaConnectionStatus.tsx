import { useState, useCallback, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';

interface MetaConnectionInfo {
    hasInstagram: boolean;
    hasMessenger: boolean;
    instagramUsername: string | null;
    pageName: string | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

/**
 * Hook centralizado para verificar o status das conexões Meta (Facebook/Instagram).
 * Consulta `meta_connections` uma única vez e expõe flags para Instagram e Messenger.
 */
export function useMetaConnectionStatus(): MetaConnectionInfo {
    const { currentOrganization } = useOrganization();
    const [hasInstagram, setHasInstagram] = useState(false);
    const [hasMessenger, setHasMessenger] = useState(false);
    const [instagramUsername, setInstagramUsername] = useState<string | null>(null);
    const [pageName, setPageName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!currentOrganization?.id) {
            setHasInstagram(false);
            setHasMessenger(false);
            setInstagramUsername(null);
            setPageName(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('meta_connections')
                .select('page_id, page_name, instagram_business_account_id, instagram_username, is_active')
                .eq('organization_id', currentOrganization.id)
                .eq('is_active', true);

            if (error) {
                console.error('Error fetching meta connections:', error);
                return;
            }

            const connections = data || [];

            // Messenger: qualquer conexão ativa com page_id
            const messengerConn = connections.find(c => !!c.page_id);
            setHasMessenger(!!messengerConn);
            setPageName(messengerConn?.page_name || null);

            // Instagram: conexão ativa com instagram_business_account_id
            const igConn = connections.find(c => !!c.instagram_business_account_id);
            setHasInstagram(!!igConn);
            setInstagramUsername(igConn?.instagram_username || null);
        } catch (err) {
            console.error('Error checking meta connection status:', err);
        } finally {
            setLoading(false);
        }
    }, [currentOrganization?.id]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        hasInstagram,
        hasMessenger,
        instagramUsername,
        pageName,
        loading,
        refresh,
    };
}
