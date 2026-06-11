'use client';

import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, QrCode, CheckCircle2, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from '@/hooks/use-toast';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  sessionName: string;
}

export function QRCodeModal({ isOpen, onClose, sessionId, sessionName }: QRCodeModalProps) {
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'qr' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isOpen || !sessionId) {
      setQrCodeData(null);
      setStatus('connecting');
      setErrorMsg(null);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    setStatus('connecting');
    setErrorMsg(null);
    setQrCodeData(null);

    const sse = new EventSource(`/api/v1/whatsapp/sessions/${sessionId}/qr`);
    eventSourceRef.current = sse;

    sse.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === 'connected') {
          setStatus('connected');
          toast({ title: 'Sucesso', description: 'WhatsApp conectado com sucesso!' });
          setTimeout(() => {
            onClose();
          }, 2000);
          sse.close();
        } else if (data.status === 'error') {
          setStatus('error');
          setErrorMsg(data.message || 'Falha ao carregar QR Code');
          sse.close();
        } else if (data.qr) {
          setStatus('qr');
          // If the QR is already a data URL (Evolution API base64), use it directly
          if (data.qr.startsWith('data:image')) {
             setQrCodeData(data.qr);
          } else {
             // Generate QR Code image from raw string
             try {
               const url = await QRCode.toDataURL(data.qr, { margin: 1, width: 256 });
               setQrCodeData(url);
             } catch(e) {
               console.error('Failed to generate QR Code image from string:', e);
             }
          }
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    sse.onerror = (err) => {
      console.warn('SSE Error:', err);
      // EventSource reconnects automatically, but if we have an error state from our API we stop
    };

    return () => {
      sse.close();
      eventSourceRef.current = null;
    };
  }, [isOpen, sessionId, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 flex flex-col items-center p-8">
        <DialogHeader className="text-center w-full">
          <DialogTitle className="text-2xl text-center text-zinc-900 dark:text-zinc-50">
            Conectar {sessionName}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">
            Abra o WhatsApp no seu celular, vá em "Aparelhos conectados" e aponte a câmera para o QR Code abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center w-64 h-64 mt-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner relative overflow-hidden">
          
          {status === 'connecting' && (
            <div className="flex flex-col items-center gap-3 text-emerald-500">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="text-sm font-medium animate-pulse">Gerando QR Code...</p>
            </div>
          )}

          {status === 'qr' && qrCodeData && (
            <div className="w-full h-full p-2 bg-white flex items-center justify-center animate-in zoom-in duration-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeData} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
            </div>
          )}

          {status === 'connected' && (
            <div className="flex flex-col items-center gap-3 text-emerald-500 animate-in zoom-in duration-300">
              <CheckCircle2 className="w-16 h-16" />
              <p className="text-lg font-bold">Conectado!</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 text-red-500">
              <AlertCircle className="w-10 h-10" />
              <p className="text-sm font-medium text-center px-4">{errorMsg}</p>
            </div>
          )}
          
        </div>

        <div className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
          <QrCode className="w-4 h-4" />
          <p>Mantenha esta tela aberta até concluir</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
