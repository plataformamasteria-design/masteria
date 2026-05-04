// src/hooks/use-notifications.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UserNotification {
  id: string;
  type: 'campaign_completed' | 'new_conversation' | 'system_error' | 'info';
  title: string;
  message: string;
  linkTo: string | null;
  metadata: Record<string, any> | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationsResponse {
  notifications: UserNotification[];
  unreadCount: number;
}

export function useNotifications(refreshInterval: number = 30000) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const sessionExpiredRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (sessionExpiredRef.current) return;
    
    try {
      const response = await fetch('/api/v1/notifications?limit=20');
      
      if (response.status === 401) {
        sessionExpiredRef.current = true;
        setNotifications([]);
        setUnreadCount(0);
        setError(null);
        return;
      }
      
      if (!response.ok) {
        throw new Error('Falha ao buscar notificações');
      }
      const data: NotificationsResponse = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error('Falha ao marcar notificação como lida');
      }

      // Atualizar estado local
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });

      if (!response.ok) {
        throw new Error('Falha ao marcar todas notificações como lidas');
      }

      // Atualizar estado local
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    fetchNotifications();

    // Auto-refresh se refreshInterval for fornecido
    if (refreshInterval > 0) {
      const interval = setInterval(fetchNotifications, refreshInterval);
      return () => clearInterval(interval);
    }
    
    return undefined;
  }, [mounted, fetchNotifications, refreshInterval]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
    mounted,
  };
}
