import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export function useUserRole() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUserRole();
    
    // Listen for auth state changes to re-check role when session is restored
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only react to explicit sign-in, NOT token refresh (role doesn't change on refresh)
      if (event === 'SIGNED_IN') {
        if (session) {
          checkUserRole();
        }
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUserRole = async () => {
    try {
      // Use getSession() (local-first, no network) to avoid logout cascades
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsSubAdmin(false);
        setIsLoading(false);
        return;
      }

      // Buscar todos os roles do usuário
      const rolesRes = await withTimeout(
        (supabase as any)
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id),
        8000,
        'user_roles select'
      );

      const roles = (rolesRes as any)?.data;

      const userRoles = roles?.map((r: any) => r.role) || [];
      
      // Super admin tem acesso total
      const isSuperAdminUser = userRoles.includes('super_admin');
      setIsSuperAdmin(isSuperAdminUser);
      
      // Sub admin tem acesso elevado baseado no plano
      const isSubAdminUser = userRoles.includes('sub_admin');
      setIsSubAdmin(isSubAdminUser);
      
      // Admin, super_admin ou sub_admin têm acesso de admin
      setIsAdmin(isSuperAdminUser || isSubAdminUser || userRoles.includes('admin'));
    } catch (error) {
      console.error('Error checking user role:', error);
      // DON'T reset roles on errors - keep existing state to prevent logout cascade
    } finally {
      setIsLoading(false);
    }
  };

  return { isAdmin, isSuperAdmin, isSubAdmin, isLoading };
}
