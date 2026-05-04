/**
 * ✅ FASE 2.3: Componente EmptySessionsState
 * Estado vazio quando não há sessões
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Smartphone } from 'lucide-react';
import { CreateSessionDialog } from './create-session-dialog';

interface EmptySessionsStateProps {
  onCreateSession: (name: string) => Promise<any>;
  onSessionCreated: (sessionId: string, sessionName: string) => Promise<void>;
}

export function EmptySessionsState({
  onCreateSession,
  onSessionCreated,
}: EmptySessionsStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Smartphone className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhuma sessão criada</h3>
        <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
          Crie uma nova sessão para conectar uma conta WhatsApp via QR Code
        </p>
        <CreateSessionDialog onCreateSession={onCreateSession} onSessionCreated={onSessionCreated} />
      </CardContent>
    </Card>
  );
}
