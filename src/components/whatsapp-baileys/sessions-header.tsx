/**
 * ✅ FASE 2.3: Componente SessionsHeader
 * Cabeçalho da página de sessões
 */

'use client';

import { CreateSessionDialog } from './create-session-dialog';

interface SessionsHeaderProps {
  onCreateSession: (name: string) => Promise<any>;
  onSessionCreated: (sessionId: string, sessionName: string) => Promise<void>;
}

export function SessionsHeader({
  onCreateSession,
  onSessionCreated,
}: SessionsHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h2 className="text-2xl font-bold">Sessões WhatsApp Normal</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie suas sessões WhatsApp conectadas via multi-dispositivo
        </p>
      </div>
      <CreateSessionDialog onCreateSession={onCreateSession} onSessionCreated={onSessionCreated} />
    </div>
  );
}
