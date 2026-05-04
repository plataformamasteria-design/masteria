'use client';

import { useState, useMemo } from 'react';
import { Phone, Loader2, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRetellCalls } from '@/hooks/useRetellCalls';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';

interface RetellCallButtonProps {
  contactId?: string;
  customerName: string;
  customerNumber: string;
  agentId?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  trigger?: React.ReactNode;
}

export function RetellCallButton({
  contactId,
  customerName,
  customerNumber,
  agentId,
  variant = 'default',
  size = 'default',
  className,
  trigger,
}: RetellCallButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { initiateCall, loading: isInitiating } = useRetellCalls();
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const handleInitiateCall = async () => {
    const result = await initiateCall({
      phoneNumber: customerNumber,
      customerName,
      contactId,
      agentId,
    });

    setShowConfirmDialog(false);

    if (result.success) {
      notify.success('Chamada iniciada!', result.message || `Ligando para ${customerName}...`);
    } else {
      notify.error('Erro ao iniciar chamada', result.error || 'Erro desconhecido');
    }
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setShowConfirmDialog(true)} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={() => setShowConfirmDialog(true)}
        >
          <PhoneCall className="h-4 w-4 mr-2" />
          {size !== 'icon' && 'Ligar'}
        </Button>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-green-500" />
              Confirmar Chamada
            </DialogTitle>
            <DialogDescription>
              Deseja iniciar uma chamada de voz com IA para {customerName}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 bg-muted/50 rounded-lg px-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Nome:</span>
              <span className="font-medium">{customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Telefone:</span>
              <span className="font-medium font-mono">{customerNumber}</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isInitiating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleInitiateCall}
              disabled={isInitiating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isInitiating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Phone className="mr-2 h-4 w-4" />
              )}
              Iniciar Chamada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
