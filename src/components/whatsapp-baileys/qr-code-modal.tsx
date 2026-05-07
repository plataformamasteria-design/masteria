'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { useToast } from '@/hooks/use-toast';

interface QRCodeModalProps {
  sessionId: string | null;
  sessionName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeModal({ sessionId, sessionName, isOpen, onClose }: QRCodeModalProps) {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'qr' | 'connected' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [hasShownSuccessToast, setHasShownSuccessToast] = useState(false);

  useEffect(() => {
    if (!sessionId || !isOpen) {
      setQrCode(null);
      setStatus('loading');
      setError(null);
      setHasShownSuccessToast(false);
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectEventSource = async (isReconnect: boolean = false) => {
      if (!sessionId || !isOpen) return;

      if (isReconnect) {
        try {
          console.log('[QR Modal] Reconnecting - calling reconnect API first...');
          const response = await fetch(`/api/v1/whatsapp/sessions/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reconnect' }),
          });

          if (!response.ok) {
            throw new Error('Failed to reconnect session');
          }
          
          console.log('[QR Modal] Session reconnected successfully, now connecting SSE...');
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('[QR Modal] Error reconnecting session:', error);
          setStatus('error');
          setError('Não foi possível reconectar. Tente novamente.');
          return;
        }
      }

      eventSource = new EventSource(`/api/v1/whatsapp/sessions/${sessionId}/qr`);

      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.qr) {
            let qrDataUrl = data.qr;
            
            // Se não for uma imagem base64 (for apenas o texto do pareamento), converta para QR
            if (typeof data.qr === 'string' && !data.qr.startsWith('data:image')) {
                qrDataUrl = await QRCode.toDataURL(data.qr, {
                  width: 300,
                  margin: 2,
                });
            }
            // Se data.qr for um objeto com a chave base64
            else if (typeof data.qr === 'object' && data.qr.base64) {
                qrDataUrl = data.qr.base64;
            }

            setQrCode(qrDataUrl);
            setStatus('qr');
            setError(null);
            reconnectAttempts = 0;
          }

          if (data.status === 'connected') {
            setStatus('connected');
            eventSource?.close();
            
            // ✅ CORREÇÃO: Mostrar toast de sucesso apenas uma vez
            if (!hasShownSuccessToast) {
              setHasShownSuccessToast(true);
              toast({
                title: '✅ Conectado com sucesso!',
                description: `A sessão "${sessionName}" foi conectada ao WhatsApp.`,
                duration: 5000,
              });
            }
            
            // ✅ CORREÇÃO: Fechar modal após 2 segundos (tempo suficiente para ver a mensagem de sucesso)
            setTimeout(() => {
              onClose();
            }, 2000);
          }

          if (data.status === 'disconnected') {
            setStatus('error');
            setError(data.reason ? `Falha ao conectar (${data.reason})` : 'Falha ao conectar');
            eventSource?.close();
          }

          if (data.status === 'error') {
            setStatus('error');
            setError(data.message || 'Erro desconhecido ao conectar');
            eventSource?.close();
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource error:', err);
        
        if (eventSource?.readyState === EventSource.CLOSED) {
          const currentStatus = status;
          if (reconnectAttempts < maxReconnectAttempts && currentStatus !== 'error' && currentStatus !== 'connected') {
            reconnectAttempts++;
            console.log(`[QR Modal] Reconnecting... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
            reconnectTimeout = setTimeout(() => {
              connectEventSource(true);
            }, 2000);
          } else if (currentStatus !== 'connected') {
            setStatus('error');
            setError('Não foi possível conectar ao servidor. Tente novamente.');
          }
          eventSource?.close();
        }
      };

      eventSource.onopen = () => {
        console.log('[QR Modal] EventSource connected');
        reconnectAttempts = 0;
      };
    };

    connectEventSource();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [sessionId, isOpen, onClose, hasShownSuccessToast, sessionName, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp - {sessionName}</DialogTitle>
          <DialogDescription>
            Escaneie o QR Code com seu WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-6 space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Aguardando QR Code...
              </p>
            </>
          )}

          {status === 'qr' && qrCode && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="QR Code" className="w-72 h-72" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">
                  1. Abra o WhatsApp no seu celular
                </p>
                <p className="text-sm text-muted-foreground">
                  2. Toque em Menu (⋮) ou Configurações e selecione{' '}
                  <span className="font-medium">Aparelhos conectados</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  3. Toque em <span className="font-medium">Conectar um aparelho</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  4. Aponte seu celular para esta tela para escanear o QR Code
                </p>
              </div>
            </>
          )}

          {status === 'connected' && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="text-lg font-medium text-green-600">
                Conectado com sucesso!
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-destructive" />
              <p className="text-sm text-destructive">
                {error || 'Erro desconhecido'}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
