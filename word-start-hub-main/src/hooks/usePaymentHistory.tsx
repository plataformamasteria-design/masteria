import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface PaymentRecord {
  id: string;
  organization_id: string;
  amount: number;
  status: string;
  reference_month: string;
  mercadopago_payment_id: string | null;
  mercadopago_preference_id: string | null;
  mercadopago_external_reference: string | null;
  payment_method: string | null;
  payment_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
  notes: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  boleto_url: string | null;
  payment_link: string | null;
}

export function usePaymentHistory(orgId?: string) {
  const { currentOrganization } = useOrganization();
  const targetOrgId = orgId || currentOrganization?.id;
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!targetOrgId) return;
    setIsLoading(true);
    
    // Paginate to get ALL invoices (Supabase default limit is 1000)
    const allPayments: PaymentRecord[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data } = await (supabase as any)
        .from('payment_history')
        .select('*')
        .eq('organization_id', targetOrgId)
        .order('reference_month', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (data && data.length > 0) {
        allPayments.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    setPayments(allPayments);
    setIsLoading(false);
  }, [targetOrgId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  return { payments, isLoading, refresh: fetchPayments };
}
