'use client';

import { useState, useEffect } from 'react';
// ✅ FASE 1.1: Usar hook WebSocket ao invés de polling
import { useWhatsAppSessionsWS } from '@/hooks/use-whatsapp-sessions-ws';
import { QRCodeModal } from './qr-code-modal';
// ✅ FASE 2.3: Componentes Modulares
import { SessionsHeader } from './sessions-header';
import { SessionsGrid } from './sessions-grid';
import { EmptySessionsState } from './empty-sessions-state';
import { SessionsLoadingState } from './sessions-loading-state';

export function SessionsList() {
  // ✅ FASE 1.1: Usar hook WebSocket para atualizações em tempo real
  const { sessions, isLoading, createSession, deleteSession, reconnectSession, resumeSession, mutate, connected: _connected } =
    useWhatsAppSessionsWS();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSessionName, setSelectedSessionName] = useState<string>('');
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const handleConnect = async (sessionId: string, sessionName: string) => {
    await reconnectSession(sessionId);
    setSelectedSessionId(sessionId);
    setSelectedSessionName(sessionName);
    setQrModalOpen(true);
  };

  const handleReconnect = async (sessionId: string, sessionName: string) => {
    await reconnectSession(sessionId);
    setSelectedSessionId(sessionId);
    setSelectedSessionName(sessionName);
    setQrModalOpen(true);
  };

  const handleSessionCreated = async (sessionId: string, sessionName: string) => {
    // ✅ CORREÇÃO: Prevenir múltiplas chamadas simultâneas
    if (qrModalOpen && selectedSessionId === sessionId) {
      return; // Já está processando esta sessão
    }
    
    setSelectedSessionId(sessionId);
    setSelectedSessionName(sessionName);
    setQrModalOpen(true);
    await reconnectSession(sessionId);
  };

  const handleResume = async (sessionId: string) => {
    await resumeSession(sessionId);
  };

  // ✅ CORREÇÃO: Fechar modal automaticamente quando sessão conectar via WebSocket
  useEffect(() => {
    if (!selectedSessionId || !qrModalOpen) return;

    const selectedSession = sessions.find(s => s.id === selectedSessionId);
    if (selectedSession && selectedSession.status === 'connected') {
      // Sessão conectou, fechar modal após um pequeno delay para garantir que o toast apareça
      const timer = setTimeout(() => {
        setQrModalOpen(false);
        setSelectedSessionId(null);
        setSelectedSessionName('');
        mutate();
      }, 500);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [sessions, selectedSessionId, qrModalOpen, mutate]);

  // ✅ FASE 2.3: Usar componentes modulares
  if (isLoading) {
    return <SessionsLoadingState />;
  }

  return (
    <div className="space-y-4">
      <SessionsHeader
        onCreateSession={createSession}
        onSessionCreated={handleSessionCreated}
      />

      {sessions.length === 0 ? (
        <EmptySessionsState
          onCreateSession={createSession}
          onSessionCreated={handleSessionCreated}
        />
      ) : (
        <SessionsGrid
          sessions={sessions}
          onConnect={handleConnect}
          onReconnect={handleReconnect}
          onResume={handleResume}
          onDelete={deleteSession}
        />
      )}

      <QRCodeModal
        sessionId={selectedSessionId}
        sessionName={selectedSessionName}
        isOpen={qrModalOpen}
        onClose={() => {
          setQrModalOpen(false);
          setSelectedSessionId(null);
          setSelectedSessionName('');
          mutate();
        }}
      />
    </div>
  );
}
