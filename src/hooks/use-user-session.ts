// src/hooks/use-user-session.ts
'use client';

import { useState, useEffect } from 'react';
import type { UserWithCompany } from '@/lib/types';
import { getUserSession } from '@/app/actions';

interface SessionData {
  user: UserWithCompany | null;
  error?: string;
  errorCode?: string;
  loading: boolean;
}

export function useUserSession(): SessionData {
  const [sessionData, setSessionData] = useState<SessionData>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const data = await getUserSession();
        setSessionData({ ...data, loading: false });
      } catch (error) {
        setSessionData({
          user: null,
          error: error instanceof Error ? error.message : 'Erro desconhecido na sessão',
          loading: false,
        });
      }
    };

    fetchSession();
  }, []);

  return sessionData;
}
