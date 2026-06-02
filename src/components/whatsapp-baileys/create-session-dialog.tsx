'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2 } from 'lucide-react';

interface CreateSessionDialogProps {
  onCreateSession: (name: string) => Promise<any>;
  onSessionCreated?: (sessionId: string, sessionName: string) => void;
}

export function CreateSessionDialog({ onCreateSession, onSessionCreated }: CreateSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-baileys-modal', handleOpen);
    return () => window.removeEventListener('open-baileys-modal', handleOpen);
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || isCreating) return; // ✅ CORREÇÃO: Prevenir múltiplos cliques

    setIsCreating(true);
    try {
      const result = await onCreateSession(name);
      
      if (result) {
        const sessionName = name;
        setName('');
        setOpen(false);
        if (onSessionCreated && result.id) {
          onSessionCreated(result.id, sessionName);
        }
      }
    } catch (error) {
      console.error('[CreateSessionDialog] Error creating session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Nova Sessão WhatsApp</DialogTitle>
          <DialogDescription>
            Crie uma nova sessão para conectar uma conta WhatsApp via QR Code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="session-name">Nome da Sessão</Label>
            <Input
              id="session-name"
              placeholder="Ex: Atendimento, Vendas, Suporte..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreate();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isCreating}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Sessão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
