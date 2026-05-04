/**
 * ✅ FASE 2.3: Componente SessionStatusBadge
 * Badge para exibir status de uma sessão
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface SessionStatusBadgeProps {
  status: string;
}

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          label: 'Conectado',
          variant: 'default' as const,
          className: 'bg-green-100 text-green-900 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-100',
          icon: CheckCircle2,
        };
      case 'connecting':
        return {
          label: 'Conectando',
          variant: 'secondary' as const,
          className: 'bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-100',
          icon: Loader2,
        };
      case 'qr':
      case 'needs_qr':
        return {
          label: 'Aguardando QR',
          variant: 'secondary' as const,
          className: 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-100',
          icon: AlertCircle,
        };
      case 'disconnected':
        return {
          label: 'Desconectado',
          variant: 'secondary' as const,
          className: 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-900/30 dark:text-gray-100',
          icon: XCircle,
        };
      case 'failed':
        return {
          label: 'Falhou',
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-100',
          icon: AlertCircle,
        };
      default:
        return {
          label: status || 'Desconhecido',
          variant: 'secondary' as const,
          className: '',
          icon: AlertCircle,
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
