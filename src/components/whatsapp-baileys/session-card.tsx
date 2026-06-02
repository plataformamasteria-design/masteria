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
    <div className="border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] bg-white/[0.02] backdrop-blur-md rounded-[2rem] overflow-hidden p-6 relative group transition-all hover:bg-white/[0.04]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-zinc-500" />
            <h3 className="text-lg font-bold tracking-tight text-white">{session.name}</h3>
          </div>
          <SessionStatusBadge status={session.status} />
        </div>
        <p className="text-xs text-zinc-500 mb-6">
          ID: {session.id.slice(0, 8)}...
        </p>
      <div className="space-y-4">
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
              className="rounded-xl border border-white/5 text-zinc-300 hover:text-white hover:bg-white/[0.05]"
              onClick={() => onReconnect(session.id, session.name)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconectar
            </Button>
          ) : (
            <Button
              size="sm"
              className="rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all"
              onClick={() => onConnect(session.id, session.name)}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Conectar
            </Button>
          )}
          {session.status !== 'connected' && session.hasAuth && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-bold"
              onClick={() => onResume(session.id)}
            >
              <ArchiveRestore className="h-4 w-4 mr-2" />
              Recuperar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
