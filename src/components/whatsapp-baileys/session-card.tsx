/**
 * ✅ FASE 2.3: Componente SessionCard
 * Card individual para exibir uma sessão WhatsApp
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone, RefreshCw, QrCode, ArchiveRestore } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BaileysSession } from '@/hooks/use-whatsapp-sessions-ws';
import { SessionStatusBadge } from './session-status-badge';

interface SessionCardProps {
  session: BaileysSession;
  onConnect: (sessionId: string, sessionName: string) => void;
  onReconnect: (sessionId: string, sessionName: string) => void;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export function SessionCard({
  session,
  onConnect,
  onReconnect,
  onResume,
  onDelete: _onDelete,
}: SessionCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{session.name}</CardTitle>
          </div>
          <SessionStatusBadge status={session.status} />
        </div>
        <CardDescription className="text-xs">
          ID: {session.id.slice(0, 8)}...
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {session.phone && (
          <div className="text-sm">
            <span className="font-medium">Telefone:</span> {session.phone}
          </div>
        )}
        {session.lastConnected && (
          <div className="text-sm text-muted-foreground">
            Última conexão:{' '}
            {format(new Date(session.lastConnected), "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </div>
        )}
        <div className="flex gap-2">
          {session.status === 'connected' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReconnect(session.id, session.name)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconectar
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => onConnect(session.id, session.name)}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Conectar
            </Button>
          )}
          {session.status !== 'connected' && session.hasAuth && (
            <Button
              variant="secondary"
              size="sm"
              className="bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:hover:bg-amber-900/50"
              onClick={() => onResume(session.id)}
            >
              <ArchiveRestore className="h-4 w-4 mr-2" />
              Recuperar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
