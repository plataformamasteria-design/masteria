
'use client';

import React from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    PlusCircle,
    Loader2,
    Instagram,
    RefreshCw
} from 'lucide-react';

import { useConnections } from '@/hooks/use-connections';
import { WebhookInfoCard } from './connections/webhook-info-card';
import { TokenAlerts } from './connections/token-alerts';
import { ConnectionsTable } from './connections/connections-table'; // New Table Component
import { ConnectionDialog } from './connections/connection-dialog';
import { ImportDialog } from './connections/import-dialog';
import { getInstagramAuthUrl } from '@/app/actions/instagram-connect';
import { toast } from '@/hooks/use-toast';

export function ConnectionsManager() {
    const {
        connections,
        loading,
        isSyncingWebhook,
        isImporting,

        isEditModalOpen,
        setIsEditModalOpen,
        editingConnection,
        openEditModal,

        isImportModalOpen,
        setIsImportModalOpen,
        foundConnections,
        importLogs, // Destructure

        fetchConnections,
        handleToggleActive,
        handleDelete,
        handleSyncWebhook,
        handleSaveConnection,
        handleAutoImport,
        confirmImport,
        checkConnectionHealth: _checkConnectionHealth,
        refreshSingleConnection,
        renewConnectionToken,
        connectBaileys,
        disconnectBaileys,
    } = useConnections();

    // Force Rebuild: Ensure hook updates are picked up
    // console.log('ConnectionsManager rendered', { connectBaileys, disconnectBaileys });

    React.useEffect(() => {
        const handleOpen = () => setIsEditModalOpen(true);
        window.addEventListener('open-official-modal', handleOpen);
        return () => window.removeEventListener('open-official-modal', handleOpen);
    }, [setIsEditModalOpen]);

    return (
        <div className="space-y-6">
            <TokenAlerts connections={connections} />

            {/* HEADER ACTIONS - Consolidated row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">Conexões Ativas</h2>
                    <p className="text-sm text-zinc-400">Gerencie suas contas do WhatsApp Business e Instagram.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchConnections(true)}
                        disabled={loading}
                        className="rounded-xl border border-white/5 text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleAutoImport}
                        disabled={isImporting}
                        className="w-full sm:w-auto rounded-xl border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                    >
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" width={16} height={16} alt="FB" className="mr-2" />}
                        Importar do Facebook
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full sm:w-auto rounded-xl border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                        onClick={async () => {
                            const { dismiss } = toast({
                                title: "Aguarde",
                                description: "Gerando link de login do Instagram..."
                            });

                            try {
                                const res = await getInstagramAuthUrl();
                                if (res.success && res.url) {
                                    window.location.href = res.url;
                                } else {
                                    toast({
                                        title: "Erro",
                                        description: 'Erro ao gerar link do Instagram: ' + res.error,
                                        variant: "destructive"
                                    });
                                }
                            } catch (e: any) {
                                toast({
                                    title: "Erro",
                                    description: 'Erro: ' + e.message,
                                    variant: "destructive"
                                });
                            } finally {
                                dismiss();
                            }
                        }}
                    >
                        <Instagram className="mr-2 h-4 w-4" />
                        Conectar Instagram
                    </Button>

                </div>
            </div>

            {/* WEBHOOK INFO - Now in specific compact accordion card */}
            <WebhookInfoCard />

            <div className="space-y-6">
                {loading ? (
                    <div className="flex items-center justify-center p-8 sm:p-16 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] bg-white/[0.02] backdrop-blur-md rounded-[2rem]">
                        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-zinc-500" />
                    </div>
                ) : (
                    /* MAIN TABLE VIEW */
                    <ConnectionsTable
                        connections={connections.filter(c => c.connectionType !== 'baileys' && c.connectionType !== 'evolution')}
                        isSyncingWebhook={isSyncingWebhook}
                        onToggleActive={handleToggleActive}
                        onSyncWebhook={handleSyncWebhook}
                        onEdit={openEditModal}
                        onDelete={handleDelete}
                        onCheckHealth={async (connection) => { await refreshSingleConnection(connection.id); }}
                        onRenewToken={renewConnectionToken}
                        onConnectBaileys={connectBaileys}
                        onDisconnectBaileys={disconnectBaileys}
                    />
                )}
            </div>

            {/* DIALOGS */}
            <ImportDialog
                open={isImportModalOpen}
                onOpenChange={setIsImportModalOpen}
                foundConnections={foundConnections}
                logs={importLogs} // Pass logs
                onConfirm={confirmImport}
            />

            <ConnectionDialog
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                editingConnection={editingConnection}
                onSave={handleSaveConnection}
            />
        </div>
    );
}
