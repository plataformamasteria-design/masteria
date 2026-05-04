'use client';

import { useState } from 'react';

export interface RetellCallResult {
  success: boolean;
  callId?: string;
  status?: string;
  message?: string;
  error?: string;
}

export function useRetellCalls() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateCall = async (params: {
    phoneNumber: string;
    customerName?: string;
    contactId?: string;
    agentId?: string;
  }): Promise<RetellCallResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/voice/initiate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Erro ao iniciar chamada';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      return {
        success: true,
        callId: data.callId,
        status: data.status,
        message: data.message,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    initiateCall,
    loading,
    error,
  };
}
