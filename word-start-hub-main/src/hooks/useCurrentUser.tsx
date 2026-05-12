import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CurrentUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  message_signature_enabled?: boolean;
  show_team_assigned_chats?: boolean;
}

const STORAGE_KEY = 'current_user_cache';

export const useCurrentUser = () => {
  // Inicializar com dados do cache se disponíveis
  const getCachedUser = (): CurrentUser | null => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const [user, setUser] = useState<CurrentUser | null>(getCachedUser());
  const [loading, setLoading] = useState(true);

  const updateUser = (userData: CurrentUser | null) => {
    setUser(userData);
    if (userData) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      } catch (error) {
        console.error('Error caching user data:', error);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    let profileSubscription: any = null;

    const fetchUser = async () => {
      try {
        // Use getSession() (local-first, no network) to avoid logout cascades
        const { data: { session } } = await supabase.auth.getSession();
        const authUser = session?.user;
        
        if (!authUser) {
          updateUser(null);
          setLoading(false);
          return;
        }

        const impersonatedId = localStorage.getItem('impersonated_user_id');
        const targetUserId = impersonatedId || authUser.id;

      // NOTE: explicit any to avoid TS mismatch while generated DB types propagate.
      const profileRes: any = await (supabase as any)
        .from('profiles')
        .select('full_name, avatar_url, message_signature_enabled, show_team_assigned_chats')
        .eq('id', targetUserId)
        .maybeSingle();

      const profileRow: any = profileRes?.data ?? null;

        const userData: CurrentUser = {
          id: targetUserId,
          email: impersonatedId ? 'impersonated@agent.com' : (authUser.email || ''),
          full_name: profileRow?.full_name,
          avatar_url: profileRow?.avatar_url,
          message_signature_enabled: (profileRow?.message_signature_enabled ?? true) as boolean,
          show_team_assigned_chats: (profileRow?.show_team_assigned_chats ?? false) as boolean,
        };

        updateUser(userData);

        // Unsubscribe from previous profile subscription if it exists
        if (profileSubscription) {
          profileSubscription.unsubscribe();
        }

        // Subscribe to profile changes for this specific user
        profileSubscription = supabase
          .channel(`profile-changes-${targetUserId}`)
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles',
            filter: `id=eq.${targetUserId}`
          }, () => {
            fetchUser();
          })
          .subscribe();
      } catch (error) {
        console.error('Error fetching current user:', error);
        // Manter dados do cache em caso de erro, não limpar
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Subscribe to auth changes - only react to SIGNED_IN and SIGNED_OUT
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchUser();
      }
      // Ignore TOKEN_REFRESHED and INITIAL_SESSION to avoid reload loops
    });

    return () => {
      authSubscription.unsubscribe();
      if (profileSubscription) {
        profileSubscription.unsubscribe();
      }
    };
  }, []);

  return { user, loading };
};
