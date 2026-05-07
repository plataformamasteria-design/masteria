'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ConnectionsClient } from '@/components/settings/connections-client';
import { SessionsList } from '@/components/whatsapp-baileys/sessions-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plug, QrCode } from 'lucide-react';
import { motion } from 'framer-motion';

const tabMotion = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: 'easeOut' },
};

export default function ConexoesHubPage() {
    const [activeTab, setActiveTab] = useState('business');

    return (
        <div className="space-y-6">
            <PageHeader
                title="Conexões"
                description="Gerencie suas conexões de WhatsApp Business e sessões do WhatsApp (Evolution API)."
                icon={Plug}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="overflow-x-auto -mx-2 px-2 pb-1">
                    <TabsList className="inline-flex h-auto min-w-max gap-1">
                        <TabsTrigger value="business" className="flex items-center gap-2 px-4 py-2">
                            <Plug className="h-4 w-4 shrink-0" />
                            <span>WhatsApp Business & Instagram</span>
                        </TabsTrigger>
                        <TabsTrigger value="baileys" className="flex items-center gap-2 px-4 py-2">
                            <QrCode className="h-4 w-4 shrink-0" />
                            <span>Sessões (Evolution API)</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="business" className="mt-6">
                    <motion.div {...tabMotion}>
                        <ConnectionsClient />
                    </motion.div>
                </TabsContent>

                <TabsContent value="baileys" className="mt-6" forceMount={false}>
                    {activeTab === 'baileys' && (
                        <motion.div {...tabMotion}>
                            <SessionsList />
                        </motion.div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
