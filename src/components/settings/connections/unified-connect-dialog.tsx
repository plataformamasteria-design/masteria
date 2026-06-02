'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, QrCode, Plug } from 'lucide-react';

export function UnifiedConnectDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold shadow-[0_0_15px_rgba(16,185,129,0.1),inset_0_0_10px_rgba(16,185,129,0.1)] transition-all"
      >
        <PlusCircle className="mr-2 h-4 w-4 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        Nova Conexão
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-xl dark:shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-900 dark:text-zinc-50">Qual tipo de conexão você deseja criar?</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Selecione a tecnologia da API que deseja configurar no MasterIA.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <Button 
              variant="outline" 
              className="h-auto py-6 flex flex-col items-center gap-3 justify-center border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all rounded-xl"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent('open-official-modal'));
              }}
            >
              <Plug className="h-10 w-10 text-blue-500 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] dark:drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
              <div className="text-center space-y-1">
                <div className="font-bold text-base text-zinc-900 dark:text-zinc-200">API Oficial</div>
                <div className="text-xs text-zinc-500 font-normal">WhatsApp Cloud & Insta</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="h-auto py-6 flex flex-col items-center gap-3 justify-center border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all rounded-xl"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent('open-baileys-modal'));
              }}
            >
              <QrCode className="h-10 w-10 text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <div className="text-center space-y-1">
                <div className="font-bold text-base text-zinc-900 dark:text-zinc-200">API Não Oficial</div>
                <div className="text-xs text-zinc-500 font-normal">Multi-Device via QR Code</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
