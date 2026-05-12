import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

interface Organization {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  plan: string;
  settings: Record<string, any>;
  instance_name?: string | null;
  max_users?: number;
  price_per_extra_user?: number;
  trial_ends_at?: string | null;
  lifetime?: boolean;
  created_at: string;
  updated_at: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  isPlanDisabled: boolean;
  isOverUserLimit: boolean;
  currentUserCount: number;
  switchOrganization: (organizationId: string) => Promise<void>;
  viewAsOrganization: (organizationId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPlanDisabled, setIsPlanDisabled] = useState(false);
  const [isOverUserLimit, setIsOverUserLimit] = useState(false);
  const [currentUserCount, setCurrentUserCount] = useState(0);
  const currentOrgRef = useRef<Organization | null>(null);

  useEffect(() => {
    currentOrgRef.current = currentOrganization;

    // Apply org theme colors as CSS variable overrides
    let themeColors = currentOrganization?.settings?.theme_colors;

    if (themeColors) {
      const parsed = z.record(z.string()).safeParse(themeColors);
      if (!parsed.success) {
        console.error("ZOD_ERROR: Invalid theme_colors schema.", parsed.error);
        themeColors = undefined;
      } else {
        themeColors = parsed.data;
      }
    }

    // Remove old style element
    const oldStyle = document.getElementById('org-theme-overrides');
    if (oldStyle) oldStyle.remove();

    if (!themeColors) {
      return () => {
        const el = document.getElementById('org-theme-overrides');
        if (el) el.remove();
      };
    }

    const hexToHsl = (hex: string): string => {
      let r = 0, g = 0, b = 0;
      if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16);
      } else if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
      }
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
      }
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    const hslVariant = (hsl: string, lDelta: number) => {
      const parts = hsl.split(' ');
      const newL = Math.max(0, Math.min(100, parseInt(parts[2]) + lDelta));
      return `${parts[0]} ${parts[1]} ${newL}%`;
    };

    // Build CSS overrides for both modes
    let lightCSS = '';
    let darkCSS = '';

    // --- LIGHT MODE ---
    if (themeColors.primary) {
      const hsl = hexToHsl(themeColors.primary);
      lightCSS += `--primary: ${hsl}; --ring: ${hsl}; --chart-1: ${hsl};`;
      lightCSS += `--primary-hover: ${hslVariant(hsl, -5)};`;
      lightCSS += `--primary-light: ${hslVariant(hsl, 50)};`;
      lightCSS += `--success: ${hslVariant(hsl, 5)};`;
      lightCSS += `--success-light: ${hslVariant(hsl, 47)};`;
      lightCSS += `--gradient-primary: ${hsl};`;
      lightCSS += `--shadow-glow-primary: 0 0 20px hsl(${hsl} / 0.15);`;
    }
    if (themeColors.secondary) {
      const hsl = hexToHsl(themeColors.secondary);
      lightCSS += `--secondary: ${hsl};`;
      lightCSS += `--muted: ${hslVariant(hsl, 2)};`;
      lightCSS += `--muted-foreground: ${hslVariant(hsl, -49)};`;
    }
    if (themeColors.accent) {
      const hsl = hexToHsl(themeColors.accent);
      lightCSS += `--accent: ${hsl}; --chart-2: ${hsl};`;
      lightCSS += `--accent-light: ${hslVariant(hsl, 50)};`;
      lightCSS += `--gradient-accent: ${hsl};`;
      lightCSS += `--gradient-accent-end: ${hslVariant(hsl, 8)};`;
      lightCSS += `--shadow-glow-accent: 0 0 20px hsl(${hsl} / 0.15);`;
    }
    if (themeColors.gradient_end) {
      const hsl = hexToHsl(themeColors.gradient_end);
      lightCSS += `--gradient-primary-end: ${hsl}; --chart-3: ${hsl};`;
    }
    if (themeColors.light_background) {
      const hsl = hexToHsl(themeColors.light_background);
      lightCSS += `--background: ${hsl};`;
      lightCSS += `--body-bg-start: ${hsl};`;
      lightCSS += `--body-bg-mid: ${hslVariant(hsl, -1)};`;
      lightCSS += `--body-bg-end: ${hslVariant(hsl, -2)};`;
    }
    if (themeColors.light_card) {
      const hsl = hexToHsl(themeColors.light_card);
      lightCSS += `--card: ${hsl};`;
      lightCSS += `--popover: ${hsl};`;
      lightCSS += `--glass-bg: ${hsl};`;
    }
    if (themeColors.light_sidebar) {
      const hsl = hexToHsl(themeColors.light_sidebar);
      lightCSS += `--sidebar: ${hsl};`;
    }
    if (themeColors.light_border) {
      const hsl = hexToHsl(themeColors.light_border);
      lightCSS += `--border: ${hsl}; --sidebar-border: ${hsl};`;
      lightCSS += `--input: ${hslVariant(hsl, 2)};`;
      lightCSS += `--glass-border: ${hslVariant(hsl, -3)};`;
    }

    // --- DARK MODE ---
    if (themeColors.dark_primary) {
      const hsl = hexToHsl(themeColors.dark_primary);
      darkCSS += `--primary: ${hsl}; --ring: ${hsl}; --chart-1: ${hsl};`;
      darkCSS += `--primary-hover: ${hslVariant(hsl, -4)};`;
      darkCSS += `--primary-light: ${hslVariant(hsl, -16)};`;
      darkCSS += `--gradient-primary: ${hsl};`;
      darkCSS += `--success: ${hslVariant(hsl, 4)};`;
      darkCSS += `--success-light: ${hslVariant(hsl, -20)};`;
      darkCSS += `--gradient-success: ${hslVariant(hsl, 4)};`;
      darkCSS += `--gradient-success-end: ${hslVariant(hsl, 14)};`;
      darkCSS += `--shadow-glow-primary: 0 0 40px hsl(${hsl} / 0.4);`;
    }
    if (themeColors.dark_secondary) {
      const hsl = hexToHsl(themeColors.dark_secondary);
      darkCSS += `--secondary: ${hsl};`;
    }
    if (themeColors.dark_accent) {
      const hsl = hexToHsl(themeColors.dark_accent);
      darkCSS += `--accent: ${hsl}; --chart-2: ${hsl};`;
      darkCSS += `--accent-light: ${hslVariant(hsl, -14)};`;
      darkCSS += `--gradient-accent: ${hsl};`;
      darkCSS += `--gradient-accent-end: ${hslVariant(hsl, 11)};`;
      darkCSS += `--shadow-glow-accent: 0 0 40px hsl(${hsl} / 0.4);`;
    }
    if (themeColors.dark_gradient_end) {
      const hsl = hexToHsl(themeColors.dark_gradient_end);
      darkCSS += `--gradient-primary-end: ${hsl}; --chart-3: ${hsl};`;
    }
    if (themeColors.dark_background) {
      const hsl = hexToHsl(themeColors.dark_background);
      darkCSS += `--background: ${hsl};`;
      darkCSS += `--foreground: 210 20% 98%;`;
      darkCSS += `--body-bg-start: ${hsl};`;
      darkCSS += `--body-bg-mid: ${hslVariant(hsl, 2)};`;
      darkCSS += `--body-bg-end: ${hslVariant(hsl, 4)};`;
    }
    if (themeColors.dark_card) {
      const hsl = hexToHsl(themeColors.dark_card);
      darkCSS += `--card: ${hsl}; --card-foreground: 210 20% 98%;`;
      darkCSS += `--popover: ${hslVariant(hsl, 2)}; --popover-foreground: 210 20% 98%;`;
      darkCSS += `--muted: ${hslVariant(hsl, 6)};`;
      darkCSS += `--muted-foreground: 215 15% 70%;`;
      darkCSS += `--input: ${hslVariant(hsl, 6)};`;
      darkCSS += `--glass-bg: ${hslVariant(hsl, 3)};`;
    }
    if (themeColors.dark_sidebar) {
      const hsl = hexToHsl(themeColors.dark_sidebar);
      darkCSS += `--sidebar: ${hsl}; --sidebar-foreground: 210 20% 98%;`;
    }
    if (themeColors.dark_border) {
      const hsl = hexToHsl(themeColors.dark_border);
      darkCSS += `--border: ${hsl}; --sidebar-border: ${hsl};`;
      darkCSS += `--glass-border: ${hslVariant(hsl, 3)};`;
    }

    const styleEl = document.createElement('style');
    styleEl.id = 'org-theme-overrides';
    styleEl.textContent = `
      .app-themed { ${lightCSS} }
      .app-themed.dark { ${darkCSS} }
    `;
    document.head.appendChild(styleEl);

    return () => {
      const el = document.getElementById('org-theme-overrides');
      if (el) el.remove();
    };
  }, [currentOrganization]);

  // Load organization data once on mount
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadOrganizationData();
    }

    // Listen for auth state changes - only react to sign in/out, NOT token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // Only reload if we don't have org data yet
        if (!currentOrgRef.current) {
          loadOrganizationData();
        }
      }

      if (event === 'SIGNED_OUT') {
        // Set offline when signing out
        supabase.auth.getSession().then(({ data: { session: outSession } }) => {
          if (outSession?.user?.id) {
            (supabase as any).from('profiles').update({ is_online: false }).eq('id', outSession.user.id).then();
          }
        });

        setCurrentOrganization(null);
        setOrganizations([]);
        setIsSuperAdmin(false);
        setIsPlanDisabled(false);
        setIsOverUserLimit(false);
        setCurrentUserCount(0);
        setIsLoading(false);
        hasLoadedRef.current = false;
      }
      // Ignore TOKEN_REFRESHED - no need to reload org data
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadOrganizationData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Use getSession() (local-first, no network) to avoid logout cascades
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setCurrentOrganization(null);
        setOrganizations([]);
        setIsSuperAdmin(false);
        setIsPlanDisabled(false);
        setIsLoading(false);
        return;
      }

      // Verificar se é super admin
      const roleRes = await withTimeout(
        (supabase as any)
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .maybeSingle(),
        8000,
        'user_roles super_admin'
      );

      const roleData = (roleRes as any)?.data;

      const isSuperAdminUser = !!roleData;
      setIsSuperAdmin(isSuperAdminUser);

      if (isSuperAdminUser) {
        // Super admin: buscar todas as organizações
        await refreshOrganizations();

        // Verificar se tem uma organização salva no localStorage
        const savedOrgId = localStorage.getItem('current_organization_id');
        if (savedOrgId) {
          const orgRes = await withTimeout(
            (supabase as any)
              .from('organizations')
              .select('*')
              .eq('id', savedOrgId)
              .maybeSingle(),
            8000,
            'organizations select saved'
          );

          const org = (orgRes as any)?.data;

          if (org) {
            setCurrentOrganization(org);
            setIsPlanDisabled(org.lifetime ? false : !org.active);
            await fetchUserCount(org.id, org.max_users || 3, !!org.lifetime);
          }
        } else {
          // Fallback to first organization to prevent UI locking with undefined keys
          const { data: firstOrg } = await (supabase as any)
            .from('organizations')
            .select('*')
            .order('name')
            .limit(1)
            .maybeSingle();

          if (firstOrg) {
            setCurrentOrganization(firstOrg);
            setIsPlanDisabled(firstOrg.lifetime ? false : !firstOrg.active);
            localStorage.setItem('current_organization_id', firstOrg.id);
            await fetchUserCount(firstOrg.id, firstOrg.max_users || 3, !!firstOrg.lifetime);
          }
        }
      } else {
        // Usuário regular: buscar organização do perfil
        const profileRes = await withTimeout(
          (supabase as any)
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .maybeSingle(),
          8000,
          'profiles select organization_id'
        );

        const profile = (profileRes as any)?.data;

        if (profile?.organization_id) {
          const orgRes = await withTimeout(
            (supabase as any)
              .from('organizations')
              .select('*')
              .eq('id', profile.organization_id)
              .maybeSingle(),
            8000,
            'organizations select profile'
          );

          const org = (orgRes as any)?.data;

          // Also fetch all user orgs for the selector
          const { data: userOrgs } = await (supabase as any)
            .from('user_organizations')
            .select('organization_id, organization:organizations(*)')
            .eq('user_id', user.id);

          const allOrgs = (userOrgs || [])
            .map((uo: any) => uo.organization)
            .filter(Boolean);

          setCurrentOrganization(org);
          setOrganizations(allOrgs.length > 0 ? allOrgs : (org ? [org] : []));
          setIsPlanDisabled(org ? (org.lifetime ? false : !org.active) : false);
          if (org) {
            await fetchUserCount(org.id, org.max_users || 3, !!org.lifetime);
          }
        } else {
          setCurrentOrganization(null);
          setOrganizations([]);
          setIsPlanDisabled(false);
          setIsOverUserLimit(false);
          setCurrentUserCount(0);
        }
      }
    } catch (error) {
      console.error('Error loading organization data:', error);
      // DON'T clear state on errors - keep existing org data to prevent logout cascade
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Configure global online heartbeat
  useEffect(() => {
    let timeoutId: number;
    let userId: string | null = null;

    const setOnlineStatus = async (isOnline: boolean) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        userId = session.user.id;
        await (supabase as any).from('profiles').update({
          is_online: isOnline,
          ...(isOnline ? { last_seen_at: new Date().toISOString() } : {})
        }).eq('id', session.user.id);
      }
    };

    const runHeartbeat = async () => {
      await setOnlineStatus(true);
      timeoutId = window.setTimeout(runHeartbeat, 60000); // 60s
    };

    runHeartbeat();

    // Handle tab close or reload
    const handleBeforeUnload = () => {
      if (userId) {
        // Use fetch with keepalive to ensure it fires during unload
        const url = `${import.meta.env.VITE_SUPABASE_URL || 'https://vittaia.supabase.co'}/rest/v1/profiles?id=eq.${userId}`;
        const token = (supabase as any).auth?.session?.()?.access_token;
        if (token) {
          fetch(url, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
            },
            body: JSON.stringify({ is_online: false }),
            keepalive: true
          }).catch(() => { });
        } else {
          // Fallback
          (supabase as any).from('profiles').update({ is_online: false }).eq('id', userId);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOnlineStatus(false);
    };
  }, []);

  const refreshOrganizations = async () => {
    try {
      const { data } = await (supabase as any)
        .from('organizations')
        .select('*')
        .order('name');

      setOrganizations(data || []);

      // Se houver uma organização atual, recarregar seus dados mais recentes
      if (currentOrganization) {
        const updatedOrg = data?.find((org: Organization) => org.id === currentOrganization.id);
        if (updatedOrg) {
          setCurrentOrganization(updatedOrg);
          setIsPlanDisabled(updatedOrg.lifetime ? false : !updatedOrg.active);
        }
      }
    } catch (error) {
      console.error('Error refreshing organizations:', error);
    }
  };

  const fetchUserCount = async (orgId: string, maxUsers: number, lifetime: boolean = false) => {
    try {
      const { count } = await (supabase as any)
        .from('user_organizations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);
      const c = count || 0;
      setCurrentUserCount(c);
      // Lifetime orgs never have user limit restrictions
      setIsOverUserLimit(lifetime ? false : c > maxUsers);
    } catch {
      setCurrentUserCount(0);
      setIsOverUserLimit(false);
    }
  };

  const switchOrganization = async (organizationId: string) => {
    try {
      const org = organizations.find(o => o.id === organizationId);
      if (org) {
        setCurrentOrganization(org);
        setIsPlanDisabled(org.lifetime ? false : !org.active);
        localStorage.setItem('current_organization_id', organizationId);
        await fetchUserCount(org.id, org.max_users || 3, !!org.lifetime);

        // Update profile's active organization (non-superadmin)
        if (!isSuperAdmin) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await (supabase as any)
              .from('profiles')
              .update({ organization_id: organizationId })
              .eq('id', session.user.id);
          }
        }
      }
    } catch (error) {
      console.error('Error switching organization:', error);
    }
  };

  const viewAsOrganization = async (organizationId: string) => {
    try {
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (org) {
        setCurrentOrganization(org);
        setIsPlanDisabled(org.lifetime ? false : !org.active);
        localStorage.setItem('current_organization_id', organizationId);
        await fetchUserCount(org.id, org.max_users || 3, !!org.lifetime);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Error viewing organization:', error);
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        organizations,
        isLoading,
        isSuperAdmin,
        isPlanDisabled,
        isOverUserLimit,
        currentUserCount,
        switchOrganization,
        viewAsOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}