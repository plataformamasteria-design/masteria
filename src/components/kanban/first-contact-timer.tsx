// src/components/kanban/first-contact-timer.tsx
// Cronômetro de tempo até o primeiro contato de um lead.
// - Se firstMessageAt = null → timer rodando em tempo real (lead aguardando)
// - Se firstMessageAt existe → tempo congelado "Respondido em X"
'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FirstContactTimerProps {
  leadCreatedAt: string;
  firstMessageAt: string | null;
  compact?: boolean; // para exibição resumida no card
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function getTimerColor(ms: number, frozen: boolean): string {
  if (frozen) return 'text-emerald-600 dark:text-emerald-400';
  const minutes = ms / 1000 / 60;
  if (minutes < 5)  return 'text-emerald-600 dark:text-emerald-400';
  if (minutes < 30) return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

export function FirstContactTimer({ leadCreatedAt, firstMessageAt, compact = false }: FirstContactTimerProps) {
  const [elapsed, setElapsed] = useState<number>(0);
  const isFrozen = !!firstMessageAt;

  useEffect(() => {
    const base = new Date(leadCreatedAt).getTime();

    if (isFrozen) {
      // Tempo congelado: delta entre criação e primeira mensagem
      setElapsed(new Date(firstMessageAt!).getTime() - base);
      return;
    }

    // Timer ativo: atualiza a cada segundo
    const tick = () => setElapsed(Date.now() - base);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [leadCreatedAt, firstMessageAt, isFrozen]);

  const colorClass = getTimerColor(elapsed, isFrozen);
  const label      = formatDuration(elapsed);

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-0.5 text-[10px] font-mono font-medium',
          colorClass,
          !isFrozen && elapsed / 1000 / 60 >= 30 && 'animate-pulse',
        )}
        title={isFrozen ? `Primeiro contato em ${label}` : `Aguardando contato há ${label}`}
      >
        <Clock className="h-3 w-3 flex-shrink-0" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-sm font-medium', colorClass)}>
      <Clock className="h-4 w-4 flex-shrink-0" />
      <span className="font-mono">{label}</span>
      <span className="text-xs font-normal opacity-80">
        {isFrozen ? '(primeiro contato)' : '(aguardando)'}
      </span>
    </div>
  );
}
