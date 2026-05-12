import { supabase } from '@/integrations/supabase/client';

/**
 * Get the organization_id for the current logged-in user
 */
export async function getCurrentUserOrganizationId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    return profile?.organization_id || null;
  } catch (error) {
    console.error('Error getting organization_id:', error);
    return null;
  }
}