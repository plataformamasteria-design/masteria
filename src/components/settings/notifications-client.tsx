'use client';

import { PageHeader } from '@/components/page-header';
import { NotificationsManager } from '@/components/settings/notifications-manager';

export function NotificationsClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agentes de Notificação"
        description="Configure agentes inteligentes para receber notificações de eventos importantes via WhatsApp."
      >
      </PageHeader>
      <NotificationsManager />
    </div>
  );
}
