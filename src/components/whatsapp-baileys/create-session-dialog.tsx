'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CreateSessionDialogProps {
  onCreateSession: (name: string) => Promise<any>;
  onSessionCreated: (id: string, name: string) => void;
}

export function CreateSessionDialog({ onCreateSession, onSessionCreated }: CreateSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-baileys-modal', handleOpen);
    return () => window.removeEventListener('open-baileys-modal', handleOpen);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Aviso', description: 'Por favor, insira um nome para a conexão.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await onCreateSession(name);
      // onCreateSession retorna a sessão em caso de sucesso, ou null em caso de falha
      if (result && typeof result === 'object' && result.id) {
        setOpen(false);
        setName('');
        onSessionCreated(result.id, result.name || name);
      } else {
        // Se falhou, o hook createSession já exibe o toast de erro
        console.error('Falha ao criar sessão, resultado:', result);
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Falha ao criar conexão.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) setOpen(v); }}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl text-zinc-900 dark:text-zinc-50">Nova Conexão (API Não Oficial)</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Dê um nome para identificar este número de WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Conexão</Label>
            <Input
              id="name"
              placeholder="Ex: Suporte Vendas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar e Gerar QR Code
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
