/**
 * ✅ FASE 2.3: Componente SessionsGrid
 * Grid de sessões com cards
 */

'use client';

import { BaileysSession } from '@/hooks/use-whatsapp-sessions-ws';
import { SessionCard } from './session-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface SessionsGridProps {
  sessions: BaileysSession[];
  onConnect: (sessionId: string, sessionName: string) => void;
  onReconnect: (sessionId: string, sessionName: string) => void;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export function SessionsGrid({
  sessions,
  onConnect,
  onReconnect,
  onResume,
  onDelete,
}: SessionsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sessions.map((session) => (
        <div key={session.id} className="relative">
          <SessionCard
            session={session}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onResume={onResume}
            onDelete={() => {}} // Delete será tratado pelo AlertDialog abaixo
          />
          <div className="absolute top-2 right-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deletar Sessão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja deletar a sessão &quot;{session.name}&quot;? Esta ação não
                    pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(session.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Deletar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );
}
