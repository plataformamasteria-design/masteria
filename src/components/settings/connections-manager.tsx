
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

    return (
        <div className="space-y-6">
            <TokenAlerts connections={connections} />

            {/* HEADER ACTIONS - Consolidated row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-medium">Conexões Ativas</h2>
                    <p className="text-sm text-muted-foreground">Gerencie suas contas do WhatsApp Business e Instagram.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchConnections(true)}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleAutoImport}
                        disabled={isImporting}
                        className="w-full sm:w-auto"
                    >
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" width={16} height={16} alt="FB" className="mr-2" />}
                        Importar do Facebook
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
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

                    <Button className="w-full sm:w-auto" onClick={() => setIsEditModalOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Manual
                    </Button>
                </div>
            </div>

            {/* WEBHOOK INFO - Now in specific compact accordion card */}
            <WebhookInfoCard />

            <div className="space-y-6">
                {loading ? (
                    <Card className="flex items-center justify-center p-8 sm:p-16">
                        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
                    </Card>
                ) : (
                    /* MAIN TABLE VIEW */
                    <ConnectionsTable
                        connections={connections}
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
