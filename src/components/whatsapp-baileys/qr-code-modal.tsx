'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle, BotMessageSquare } from 'lucide-react';
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
                  width: 400,
                  margin: 1,
                  color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                  }
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
      <DialogContent className="sm:max-w-4xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden p-0">
        <div className="p-6 md:p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Conectar WhatsApp - {sessionName}</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-base">
              Siga os passos abaixo para autenticar e conectar este número ao MasterIA.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center space-y-4">
            {status === 'loading' && (
              <div className="py-20 flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mb-4" />
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Gerando QR Code seguro...
                </p>
              </div>
            )}

            {status === 'qr' && qrCode && (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 md:gap-12 w-full">
                {/* Lado Esquerdo - QR Code */}
                <div className="flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl p-6 border border-zinc-200/50 dark:border-white/5">
                  <div className="relative bg-white p-3 rounded-2xl shadow-sm border border-zinc-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={qrCode} 
                      alt="QR Code" 
                      className="w-[280px] h-[280px] md:w-[320px] md:h-[320px] object-contain rounded-xl"
                      style={{ filter: 'grayscale(100%) contrast(500%)' }}
                    />
                    
                    {/* MasterIA Logo Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-white p-2 rounded-2xl shadow-lg border border-zinc-100 flex items-center justify-center">
                        <BotMessageSquare className="w-10 h-10 text-emerald-500" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mt-4 text-center font-medium">O QR Code expira em alguns segundos</p>
                </div>

                {/* Lado Direito - Instruções */}
                <div className="flex flex-col justify-center space-y-6">
                  <h3 className="font-bold text-xl text-zinc-900 dark:text-zinc-100">Como conectar?</h3>
                  
                  <div className="space-y-6">
                    <div className="flex gap-4 items-start">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/20">1</div>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Abra o WhatsApp</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Abra o aplicativo no seu celular principal que possui o número a ser conectado.</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 items-start">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/20">2</div>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Acesse Aparelhos Conectados</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Toque em <strong>Menu</strong> (⋮) no Android ou <strong>Configurações</strong> (⚙️) no iPhone e selecione <strong>Aparelhos conectados</strong>.</p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/20">3</div>
                      <div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Conecte um Aparelho</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Toque no botão verde <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code ao lado.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {status === 'connected' && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-20 w-20 text-emerald-500 mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Conectado com sucesso!
              </p>
              <p className="text-zinc-500 mt-2">Sua sessão foi sincronizada e já está pronta para uso.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <XCircle className="h-20 w-20 text-rose-500 mb-4 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Falha na conexão</p>
              <p className="text-sm text-rose-500 bg-rose-500/10 px-4 py-2 rounded-lg font-medium">
                {error || 'Erro desconhecido'}
              </p>
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
}
