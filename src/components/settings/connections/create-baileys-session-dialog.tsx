import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export function CreateBaileysSessionDialog({
  open,
  onOpenChange,
  onCreateSession,
  onSessionCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSession: (name: string) => Promise<any>;
  onSessionCreated: (id: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const session = await onCreateSession(name);
    setLoading(false);
    if (session) {
      onOpenChange(false);
      setName('');
      onSessionCreated(session.id, session.name);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-900 dark:text-zinc-50">Nova Conexão WhatsApp</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">
            Dê um nome para identificar este número (ex: Suporte, Vendas).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="Nome da conexão..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5"
            onKeyDown={(e) => {
               if(e.key === 'Enter') handleCreate();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar Conexão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
