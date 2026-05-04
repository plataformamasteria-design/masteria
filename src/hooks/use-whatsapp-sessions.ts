import useSWR from 'swr';
import { useToast } from './use-toast';

export interface BaileysSession {
  id: string;
  name: string;
  status: string;
  phone?: string;
  lastConnected?: Date;
  isActive: boolean;
  createdAt?: Date;
  hasAuth?: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useWhatsAppSessions() {
  const { toast } = useToast();
  const { data, error, mutate, isLoading } = useSWR<{ sessions: BaileysSession[] }>(
    '/api/v1/whatsapp/sessions',
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  const createSession = async (name: string) => {
    try {
      const res = await fetch('/api/v1/whatsapp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create session');
      }

      const result = await res.json();
      mutate();

      toast({
        title: 'Sessão criada',
        description: 'Escaneie o QR Code para conectar',
      });

      return result.session;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (error as Error).message,
      });
      return null;
    }
  };

  const deleteSession = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/whatsapp/sessions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete session');
      }

      mutate();

      toast({
        title: 'Sessão deletada',
        description: 'A sessão foi removida com sucesso',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (error as Error).message,
      });
    }
  };

  const reconnectSession = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/whatsapp/sessions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reconnect' }),
      });

      if (!res.ok) {
        throw new Error('Failed to reconnect session');
      }

      mutate();

      toast({
        title: 'Reconectando',
        description: 'A sessão está sendo reconectada',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: (error as Error).message,
      });
    }
  };

  const resumeSession = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/whatsapp/sessions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to resume session');
      }

      mutate();

      toast({
        title: 'Recuperando sessão',
        description: 'Tentando restaurar conexão com credenciais salvas...',
      });

      return true;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao recuperar',
        description: (error as Error).message,
      });
      return false;
    }
  };

  return {
    sessions: data?.sessions || [],
    isLoading,
    error,
    createSession,
    deleteSession,

    reconnectSession,
    resumeSession,
    mutate,
  };
}
