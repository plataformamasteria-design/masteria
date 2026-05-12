import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface OverdueInfo {
  hasOverdue: boolean;
  overdueCount: number;
  totalOwed: number;
  oldestDueDate: string | null;
}

export function useOverduePayments() {
  const { currentOrganization, isSuperAdmin } = useOrganization();
  const [overdueInfo, setOverdueInfo] = useState<OverdueInfo>({
    hasOverdue: false,
    overdueCount: 0,
    totalOwed: 0,
    oldestDueDate: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id || isSuperAdmin || (currentOrganization as any)?.lifetime) {
      setIsLoading(false);
      return;
    }

    const checkOverdue = async () => {
      try {
        // Check ALL overdue payments (due_date passed and not paid)
        const { data, error } = await (supabase as any)
          .from('payment_history')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .in('status', ['pending', 'failed'])
          .lt('due_date', new Date().toISOString())
          .order('due_date', { ascending: true });

        if (error) throw error;

        const overduePayments = data || [];
        setOverdueInfo({
          hasOverdue: overduePayments.length > 0,
          overdueCount: overduePayments.length,
          totalOwed: overduePayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
          oldestDueDate: overduePayments.length > 0 ? overduePayments[0].due_date : null,
        });
      } catch (err) {
        console.error('Error checking overdue payments:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkOverdue();
  }, [currentOrganization?.id, isSuperAdmin]);

  return { ...overdueInfo, isLoading };
}
