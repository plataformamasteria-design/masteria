'use client';

import { PageHeader } from '@/components/page-header';
import { UnifiedConnectionsHub } from '@/components/settings/connections/unified-connections-hub';
import { UnifiedConnectDialog } from '@/components/settings/connections/unified-connect-dialog';
import { Plug } from 'lucide-react';

export default function ConexoesHubPage() {
    return (
        <div className="space-y-12 pb-12">
            <PageHeader
                title="Conexões"
                description="Gerencie suas conexões de WhatsApp Business, Instagram e WhatsApp Não Oficial."
                icon={Plug}
            >
                <UnifiedConnectDialog />
            </PageHeader>

            <div className="space-y-8">
                <UnifiedConnectionsHub />
            </div>
        </div>
    );
}
