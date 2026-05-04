'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface VoiceAgent {
  id: string;
  name: string;
  type: 'inbound' | 'outbound' | 'transfer';
  status: 'active' | 'inactive' | 'archived';
  systemPrompt: string;
  firstMessage?: string;
  voiceId?: string;
  llmProvider: string;
  llmModel: string;
  temperature: number;
  maxTokens?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentData {
  name: string;
  type: 'inbound' | 'outbound' | 'transfer';
  systemPrompt: string;
  firstMessage?: string;
  voiceId?: string;
  llmModel?: string;
  temperature?: number;
}

export interface UpdateAgentData {
  name?: string;
  type?: 'inbound' | 'outbound' | 'transfer';
  systemPrompt?: string;
  firstMessage?: string;
  voiceId?: string;
  llmModel?: string;
  temperature?: number;
  status?: 'active' | 'inactive';
}

export interface VoiceAnalytics {
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  totalCost: number;
  callsByStatus: Record<string, number>;
}

export function useVoiceAgents() {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [analytics, setAnalytics] = useState<VoiceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAgents = useCallback(async (status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = status 
        ? `/api/v1/voice/agents?status=${status}` 
        : '/api/v1/voice/agents';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao buscar agentes');
      const data = await response.json();
      setAgents(data.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      toast({
        title: 'Erro ao carregar agentes',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/voice/analytics');
      if (!response.ok) {
          const errorText = await response.text();
          console.error('Error fetching analytics (Status ' + response.status + '):', errorText);
          throw new Error('Erro ao buscar analytics: ' + response.status);
      }
      const data = await response.json();
      setAnalytics(data.data || null);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  }, []);

  const createAgent = useCallback(async (agentData: CreateAgentData): Promise<VoiceAgent | null> => {
    try {
      const response = await fetch('/api/v1/voice/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar agente');
      }
      
      toast({
        title: 'Agente criado',
        description: `"${data.data.name}" foi criado com sucesso.`,
      });
      
      await fetchAgents();
      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar agente',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [fetchAgents, toast]);

  const updateAgent = useCallback(async (id: string, agentData: UpdateAgentData): Promise<VoiceAgent | null> => {
    try {
      const response = await fetch(`/api/v1/voice/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar agente');
      }
      
      toast({
        title: 'Agente atualizado',
        description: `"${data.data.name}" foi atualizado com sucesso.`,
      });
      
      await fetchAgents();
      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao atualizar agente',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [fetchAgents, toast]);

  const deleteAgent = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/v1/voice/agents/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao excluir agente');
      }
      
      toast({
        title: 'Agente excluído',
        description: 'O agente foi excluído com sucesso.',
      });
      
      await fetchAgents();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao excluir agente',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [fetchAgents, toast]);

  const getAgent = useCallback(async (id: string): Promise<VoiceAgent | null> => {
    try {
      const response = await fetch(`/api/v1/voice/agents/${id}`);
      if (!response.ok) throw new Error('Agente não encontrado');
      const data = await response.json();
      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao buscar agente',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  useEffect(() => {
    fetchAgents();
    fetchAnalytics();
  }, [fetchAgents, fetchAnalytics]);

  return {
    agents,
    analytics,
    loading,
    error,
    fetchAgents,
    fetchAnalytics,
    createAgent,
    updateAgent,
    deleteAgent,
    getAgent,
    activeAgents: agents.filter(a => a.status === 'active'),
    inactiveAgents: agents.filter(a => a.status !== 'active'),
  };
}
