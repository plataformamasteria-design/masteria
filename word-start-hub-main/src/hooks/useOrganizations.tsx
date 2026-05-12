import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  plan: string;
  settings: Record<string, any>;
  trial_ends_at: string | null;
  billing_day: number;
  lifetime: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationStats {
  totalUsers: number;
  totalLeads: number;
  totalMessages: number;
  totalRevenue: number;
}

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orgStats, setOrgStats] = useState<Record<string, OrganizationStats>>({});

  const fetchStatsBatch = useCallback(async (orgs: Organization[]) => {
    if (orgs.length === 0) return;

    try {
      const { data, error } = await supabase.rpc('get_organizations_stats_batch' as any);
      if (error) throw error;

      const newStats: Record<string, OrganizationStats> = {};

      // Initialize all with 0 to ensure safety
      orgs.forEach(o => {
        newStats[o.id] = { totalUsers: 0, totalLeads: 0, totalMessages: 0, totalRevenue: 0 };
      });

      if (data) {
        (data as any[]).forEach((row: any) => {
          if (newStats[row.organization_id]) {
            newStats[row.organization_id] = {
              totalUsers: Number(row.total_users) || 0,
              totalLeads: Number(row.total_leads) || 0,
              totalMessages: Number(row.total_messages) || 0,
              totalRevenue: Number(row.total_revenue) || 0,
            };
          }
        });
      }

      setOrgStats(newStats);
    } catch (error) {
      console.error('Error fetching batch stats through RPC:', error);
    }
  }, []);

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) throw error;

      const orgs = data || [];
      setOrganizations(orgs as any);
      fetchStatsBatch(orgs as any);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Erro ao carregar organizações');
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatsBatch]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const createOrganization = async (data: {
    name: string;
    slug: string;
    plan?: string;
  }) => {
    try {
      const { data: orgData, error } = await supabase
        .from('organizations')
        .insert([{
          name: data.name,
          slug: data.slug,
          plan: data.plan || 'plataforma',
          active: true,
          settings: {}
        }])
        .select()
        .single();

      if (error) throw error;

      const defaultTags = [
        {
          name: 'Lead Frio',
          color: '#60A5FA',
          organization_id: orgData.id,
          icon: 'Tag',
          order_position: 0
        },
        {
          name: 'Cliente',
          color: '#10B981',
          organization_id: orgData.id,
          icon: 'User',
          order_position: 1
        }
      ];

      await supabase.from('tags').insert(defaultTags);

      toast.success('Organização criada com sucesso');
      await fetchOrganizations();
      return true;
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast.error(error.message || 'Erro ao criar organização');
      return false;
    }
  };

  const updateOrganization = async (id: string, data: Partial<Organization>) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast.success('Organização atualizada');
      await fetchOrganizations();
      return true;
    } catch (error: any) {
      console.error('Error updating organization:', error);
      toast.error(error.message || 'Erro ao atualizar organização');
      return false;
    }
  };

  const deleteOrganization = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-organization', {
        body: { organization_id: id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Organização deletada');
      await fetchOrganizations();
      return true;
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      toast.error(error.message || 'Erro ao deletar organização');
      return false;
    }
  };

  return {
    organizations,
    isLoading,
    orgStats,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    refreshOrganizations: fetchOrganizations,
  };
}