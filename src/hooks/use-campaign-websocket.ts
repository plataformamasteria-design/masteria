'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from '@/contexts/session-context';
import type { Socket } from 'socket.io-client';

export type CampaignUpdate = {
  campaignId: string;
  status: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  updatedAt: string;
};

export type DeliveryReportUpdate = {
  campaignId: string;
  reportId: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  updatedAt: string;
};

export function useCampaignWebSocket(
  campaignId: string | undefined,
  onCampaignUpdate?: (data: CampaignUpdate) => void,
  onDeliveryReportUpdate?: (data: DeliveryReportUpdate) => void
) {
  const { session } = useSession();
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(async () => {
    if (!session?.userData?.email || !campaignId) return;

    try {
      const { createAuthenticatedSocket } = await import('@/lib/socket-lazy');
      const token = session.accessToken;

      if (!token) return;

      socketRef.current = await createAuthenticatedSocket(token);

      socketRef.current.on('connect', () => {
        console.log('[CampaignWS] Connected:', socketRef.current?.id);
        socketRef.current?.emit('subscribe_campaign', { campaignId });
      });

      socketRef.current.on(`campaign:${campaignId}:update`, (data: CampaignUpdate) => {
        console.log('[CampaignWS] Campaign update:', data);
        onCampaignUpdate?.(data);
      });

      socketRef.current.on(`campaign:${campaignId}:delivery-report`, (data: DeliveryReportUpdate) => {
        console.log('[CampaignWS] Delivery report update:', data);
        onDeliveryReportUpdate?.(data);
      });

      socketRef.current.on('disconnect', () => {
        console.log('[CampaignWS] Disconnected');
      });
    } catch (error) {
      console.error('[CampaignWS] Connection failed:', error);
    }
  }, [session, campaignId, onCampaignUpdate, onDeliveryReportUpdate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe_campaign', { campaignId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId && session) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [campaignId, session, connect, disconnect]);

  return { connected: socketRef.current?.connected ?? false };
}
