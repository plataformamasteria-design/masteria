/**
 * ✅ FASE 2.3: Componente SessionsLoadingState
 * Estado de carregamento
 */

'use client';

import { Loader2 } from 'lucide-react';

export function SessionsLoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
