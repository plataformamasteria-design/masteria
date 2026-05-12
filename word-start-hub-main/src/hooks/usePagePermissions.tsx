import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { useOrganization } from '@/contexts/OrganizationContext';

type AppPage = 'dashboard' | 'leads' | 'pipeline' | 'followup' | 'chat' | 'users' | 'developer' | 'promptia' | 'agenda' | 'teams' | 'financeiro' | 'organizations' | 'commands' | 'automations' | 'disparos' | 'diagnostico' | 'marketing';

/**
 * Maps module keys to the pages they unlock.
 * padrao is always active for every org.
 */
const MODULE_TO_PAGES: Record<string, AppPage[]> = {
  padrao: ['dashboard', 'chat', 'agenda', 'commands', 'leads', 'pipeline', 'financeiro', 'teams', 'diagnostico', 'marketing'],
  automacao_simples: ['automations', 'disparos'],
  atendente_ia: ['developer', 'promptia'],
};

// All possible pages for super_admin
const ALL_PAGES: AppPage[] = [
  'dashboard', 'leads', 'pipeline', 'followup', 'chat', 'users',
  'developer', 'promptia', 'agenda', 'teams', 'financeiro',
  'organizations', 'commands', 'automations', 'disparos', 'diagnostico', 'marketing',
];

// Helper para cache de permissões
const PERMISSIONS_CACHE_KEY = 'user_permissions_cache';
const PERMISSIONS_CACHE_TIME_KEY = 'user_permissions_cache_time';
const CACHE_VALIDITY_MS = 5 * 60 * 1000;

const getCachedPermissions = (): AppPage[] => {
  try {
    const cached = localStorage.getItem(PERMISSIONS_CACHE_KEY);
    const cacheTime = localStorage.getItem(PERMISSIONS_CACHE_TIME_KEY);
    if (cached && cacheTime) {
      const elapsed = Date.now() - parseInt(cacheTime, 10);
      if (elapsed < CACHE_VALIDITY_MS) {
        return JSON.parse(cached);
      }
    }
    return [];
  } catch {
    return [];
  }
};

const setCachedPermissions = (permissions: AppPage[]) => {
  try {
    localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(permissions));
    localStorage.setItem(PERMISSIONS_CACHE_TIME_KEY, String(Date.now()));
  } catch (e) {
    console.error('Erro ao salvar cache de permissões:', e);
  }
};

export function usePagePermissions() {
  const { isAdmin, isSuperAdmin, isSubAdmin, isLoading: roleLoading } = useUserRole();
  const { currentOrganization } = useOrganization();
  const [permissions, setPermissions] = useState<AppPage[]>(getCachedPermissions());
  const [modulePages, setModulePages] = useState<AppPage[]>([...MODULE_TO_PAGES.padrao]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch active modules for the current organization
  const fetchModulePages = useCallback(async (): Promise<AppPage[]> => {
    if (!currentOrganization?.id) return [...MODULE_TO_PAGES.padrao];

    try {
      const { data } = await (supabase as any)
        .from('organization_modules')
        .select('module_key, active')
        .eq('organization_id', currentOrganization.id)
        .eq('active', true);

      if (!data || data.length === 0) {
        return [...MODULE_TO_PAGES.padrao];
      }

      const pages = new Set<AppPage>();
      for (const mod of data) {
        const modPages = MODULE_TO_PAGES[mod.module_key];
        if (modPages) {
          modPages.forEach(p => pages.add(p));
        }
      }
      // Ensure padrao pages are always available
      MODULE_TO_PAGES.padrao.forEach(p => pages.add(p));

      return Array.from(pages);
    } catch (error) {
      console.error('Error fetching module pages:', error);
      return [...MODULE_TO_PAGES.padrao];
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (!roleLoading) {
      fetchPermissions();
    }
  }, [roleLoading, isAdmin, isSuperAdmin, isSubAdmin, currentOrganization?.id]);

  const fetchPermissions = async () => {
    try {
      let newPermissions: AppPage[] = [];

      // Super Admin: full access including organizations (ignores modules)
      if (isSuperAdmin) {
        newPermissions = [...ALL_PAGES];
        setModulePages([...ALL_PAGES]);
        setPermissions(newPermissions);
        setCachedPermissions(newPermissions);
        setIsLoading(false);
        return;
      }

      // Get pages available from active modules (for agents only)
      const availablePages = await fetchModulePages();
      setModulePages(availablePages);

      // All pages except organizations and super-admin-only items
      const allNonSuperPages = ALL_PAGES.filter(p => p !== 'organizations');

      // Admin (não sub_admin): all pages except organizations
      if (isAdmin && !isSubAdmin) {
        newPermissions = allNonSuperPages;
        setPermissions(newPermissions);
        setCachedPermissions(newPermissions);
        setIsLoading(false);
        return;
      }

      // Sub Admin: all pages except organizations (ignores module restrictions)
      if (isSubAdmin) {
        newPermissions = allNonSuperPages;
        setPermissions(newPermissions);
        setCachedPermissions(newPermissions);
        setIsLoading(false);
        return;
      }

      // Agent: individual permissions filtered by active modules
      // Use getSession() (local-first, no network) to avoid logout cascades
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        newPermissions = [];
        setPermissions(newPermissions);
        setCachedPermissions(newPermissions);
        setIsLoading(false);
        return;
      }

      const impersonatedId = localStorage.getItem('impersonated_user_id');
      const targetUserId = impersonatedId || user.id;

      const { data } = await (supabase as any)
        .from('user_page_permissions')
        .select('page')
        .eq('user_id', targetUserId);

      if (data) {
        const userPermissions = data.map((p: any) => p.page as AppPage);
        newPermissions = userPermissions.filter((p: AppPage) => availablePages.includes(p));
      }

      setPermissions(newPermissions);
      setCachedPermissions(newPermissions);
    } catch (error) {
      console.error('Error fetching page permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (page: AppPage): boolean => {
    return permissions.includes(page);
  };

  const hasPendingAuthorization = (): boolean => {
    if (isSuperAdmin || isAdmin || isSubAdmin) return false;
    return permissions.length === 0;
  };

  // Synchronous: returns the current module-based available pages
  const getPlanPages = (): AppPage[] => {
    return modulePages;
  };

  return {
    permissions,
    hasPermission,
    hasPendingAuthorization,
    getPlanPages,
    isLoading: isLoading || roleLoading,
    isAdmin,
    isSuperAdmin,
    isSubAdmin,
  };
}