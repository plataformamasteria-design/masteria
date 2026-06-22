import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, BotMessageSquare, Smartphone } from 'lucide-react';
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
             const base64 = await QRCode.toDataURL(data.qr, { width: 360, margin: 1, color: { dark: '#000000', light: '#ffffff' }, errorCorrectionLevel: 'Q' });
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
      <DialogContent className="sm:max-w-3xl bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 shadow-xl flex flex-col items-center">
        <DialogHeader className="w-full">
          <DialogTitle className="text-zinc-900 dark:text-zinc-50 text-center sm:text-left">Conectar {sessionName}</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-center sm:text-left">
            Escaneie o QR Code abaixo com o seu WhatsApp para sincronizar o aparelho.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col md:flex-row items-center md:items-start justify-center min-h-[350px] w-full gap-10">
          <div className="flex flex-col items-center justify-center flex-shrink-0">
            {error ? (
              <div className="text-rose-500 text-center font-medium max-w-xs">{error}</div>
            ) : status === 'connected' ? (
               <div className="text-emerald-500 font-bold text-center flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  <div className="text-5xl mb-2">✅</div>
                  Dispositivo Conectado com Sucesso!
               </div>
            ) : qrBase64 ? (
              <div className="relative bg-white p-4 rounded-3xl shadow-xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-500">
                <Image src={qrBase64} alt="QR Code" width={320} height={320} className="rounded-xl grayscale contrast-200 mix-blend-multiply" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white p-3 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.1)] border-[4px] border-white flex items-center justify-center">
                    <BotMessageSquare className="w-12 h-12 text-emerald-500" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-zinc-500 h-[320px] w-[320px] justify-center bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                <p className="font-medium animate-pulse">Gerando QR Code...</p>
              </div>
            )}
          </div>

          {(qrBase64 || status === 'connecting' || status === 'qr') && status !== 'connected' && (
            <div className="flex-1 space-y-6 w-full animate-in fade-in slide-in-from-right-4 duration-700 delay-150 fill-mode-both">
               <div className="space-y-2">
                 <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
                   <span className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-lg text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                     <Smartphone className="w-5 h-5" />
                   </span>
                   Como conectar o seu WhatsApp
                 </h3>
                 <p className="text-sm text-zinc-500 dark:text-zinc-400">
                   Siga os passos rápidos abaixo no seu aparelho celular principal para autenticar a conexão.
                 </p>
               </div>
               
               <ol className="relative border-l-2 border-zinc-100 dark:border-zinc-800 ml-4 space-y-8 mt-6">
                 <li className="pl-8 relative">
                   <span className="absolute -left-[17px] flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-sm font-bold ring-4 ring-white dark:ring-zinc-950 border border-emerald-200 dark:border-emerald-800 shadow-sm">1</span>
                   <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Abra o WhatsApp no seu celular</p>
                 </li>
                 <li className="pl-8 relative">
                   <span className="absolute -left-[17px] flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-sm font-bold ring-4 ring-white dark:ring-zinc-950 border border-emerald-200 dark:border-emerald-800 shadow-sm">2</span>
                   <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Toque em <strong>Mais opções</strong> (três pontinhos) ou <strong>Configurações</strong></p>
                 </li>
                 <li className="pl-8 relative">
                   <span className="absolute -left-[17px] flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-sm font-bold ring-4 ring-white dark:ring-zinc-950 border border-emerald-200 dark:border-emerald-800 shadow-sm">3</span>
                   <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Toque em <strong>Aparelhos conectados</strong> e depois em <strong>Conectar um aparelho</strong></p>
                 </li>
                 <li className="pl-8 relative">
                   <span className="absolute -left-[17px] flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-sm font-bold ring-4 ring-white dark:ring-zinc-950 border border-emerald-200 dark:border-emerald-800 shadow-sm">4</span>
                   <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Aponte a câmera para esta tela e centralize o QR Code</p>
                 </li>
               </ol>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
