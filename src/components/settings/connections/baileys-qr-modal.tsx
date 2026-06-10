import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import Image from 'next/image';

export function BaileysQrModal({
  isOpen,
  onClose,
  sessionId,
  sessionName,
}: {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  sessionName: string;
}) {
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('connecting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sessionId) {
      setQrBase64(null);
      setStatus('connecting');
      setError(null);
      return;
    }

    const eventSource = new EventSource(`/api/v1/whatsapp/sessions/${sessionId}/qr`);

    eventSource.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.qr) {
          // If it's already a base64 image (starts with data:image)
          if (data.qr.startsWith('data:image')) {
             setQrBase64(data.qr);
          } else {
             // Evolution API usually returns the raw QR string, we convert it to base64 image
             const base64 = await QRCode.toDataURL(data.qr, { width: 256, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
             setQrBase64(base64);
          }
          setStatus('qr');
        } else if (data.status) {
          setStatus(data.status);
          if (data.status === 'connected') {
            setTimeout(onClose, 2000); // Close after 2 seconds
          }
        } else if (data.error) {
           setError(data.error);
        }
      } catch (err) {
        console.error('Failed to parse SSE data', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setError('Erro ao carregar o QR Code. Verifique se a sessão já está conectada ou se a API está online.');
    };

    return () => {
      eventSource.close();
    };
  }, [isOpen, sessionId, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 shadow-xl flex flex-col items-center">
        <DialogHeader className="w-full">
          <DialogTitle className="text-zinc-900 dark:text-zinc-50 text-center">Conectar {sessionName}</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-center">
            Escaneie o QR Code abaixo com o seu WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center justify-center min-h-[250px] w-full">
          {error ? (
            <div className="text-rose-500 text-center font-medium">{error}</div>
          ) : status === 'connected' ? (
             <div className="text-emerald-500 font-bold text-center flex flex-col items-center animate-in fade-in zoom-in duration-300">
                <div className="text-5xl mb-2">✅</div>
                Dispositivo Conectado com Sucesso!
             </div>
          ) : qrBase64 ? (
            <div className="bg-white p-4 rounded-xl shadow-md border border-zinc-200 animate-in fade-in duration-300">
              <Image src={qrBase64} alt="QR Code" width={220} height={220} className="rounded" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-zinc-500">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
              <p>Gerando QR Code...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
