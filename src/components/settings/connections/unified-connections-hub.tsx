'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Instagram, Grid } from 'lucide-react';
import { useConnections } from '@/hooks/use-connections';
import { useWhatsAppSessionsWS } from '@/hooks/use-whatsapp-sessions-ws';
import { WebhookInfoCard } from './webhook-info-card';
import { TokenAlerts } from './token-alerts';
import { ImportDialog } from './import-dialog';
import { ConnectionDialog } from './connection-dialog';
import { QRCodeModal } from '@/components/whatsapp-baileys/qr-code-modal';
import { CreateSessionDialog } from '@/components/whatsapp-baileys/create-session-dialog';
import { getInstagramAuthUrl } from '@/app/actions/instagram-connect';
import { toast } from '@/hooks/use-toast';
import { UnifiedConnectionCard, UnifiedConnectionItem, UnifiedPlatform, UnifiedStatus } from './unified-connection-card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function UnifiedConnectionsHub() {
    // --- 1. Hook Oficial (Meta / Insta) ---
    const {
        connections: officialConnections,
        loading: loadingOfficial,
        isSyncingWebhook,
        isImporting,
        isEditModalOpen,
        setIsEditModalOpen,
        editingConnection,
        openEditModal,
        isImportModalOpen,
        setIsImportModalOpen,
        foundConnections,
        importLogs,
        fetchConnections,
        handleToggleActive,
        handleDelete: deleteOfficialConnection,
        handleSyncWebhook,
        handleSaveConnection,
        handleAutoImport,
        confirmImport,
        refreshSingleConnection,
        renewConnectionToken,
    } = useConnections();

    // --- 2. Hook Não Oficial (Evolution) ---
    const {
        sessions: unofficialSessions,
        isLoading: loadingUnofficial,
        deleteSession: deleteUnofficialSession,
        reconnectSession: reconnectUnofficialSession,
        resumeSession: resumeUnofficialSession,
        createSession: createBaileysSession,
    } = useWhatsAppSessionsWS();

    // --- State para Modais Baileys ---
    const [qrModalOpen, setQrModalOpen] = React.useState(false);
    const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
    const [selectedSessionName, setSelectedSessionName] = React.useState<string>('');

    // --- State para Exclusão Unificada ---
    const [itemToDelete, setItemToDelete] = React.useState<{ id: string, platform: UnifiedPlatform } | null>(null);

    // --- Listeners para Modais ---
    React.useEffect(() => {
        const handleOpen = () => setIsEditModalOpen(true);
        window.addEventListener('open-official-modal', handleOpen);
        
        const handleOpenQR = (e: CustomEvent) => {
            setSelectedSessionId(e.detail.sessionId);
            setSelectedSessionName(e.detail.sessionName);
            setQrModalOpen(true);
        };
        window.addEventListener('open-qr-modal', handleOpenQR as EventListener);
        
        return () => {
            window.removeEventListener('open-official-modal', handleOpen);
            window.removeEventListener('open-qr-modal', handleOpenQR as EventListener);
        };
    }, [setIsEditModalOpen]);

    // --- Mapping ---
    const unifiedItems = useMemo<UnifiedConnectionItem[]>(() => {
        const items: UnifiedConnectionItem[] = [];

        // Mapear Oficiais
        // Filtrar evolution/baileys que possam vir da tabela conexões 
        const onlyOfficial = officialConnections.filter(c => c.connectionType !== 'evolution' && c.connectionType !== 'baileys');
        
        for (const conn of onlyOfficial) {
            let status: UnifiedStatus = 'disconnected';
            if (conn.connectionStatus === 'Conectado') status = 'connected';
            else if (conn.connectionStatus === 'Falha na Conexão') status = 'error';
            else if (conn.connectionStatus === 'Não Verificado') status = 'verifying';

            items.push({
                id: conn.id,
                name: conn.config_name,
                platform: (conn.connectionType as UnifiedPlatform) || 'meta_api',
                status,
                identifier: conn.phone || conn.phoneNumber || conn.phoneNumberId,
                createdAt: new Date(conn.createdAt || Date.now()),
                webhookStatus: conn.webhookStatus,
                healthStatus: conn.healthStatus,
                tokenExpiresInDays: conn.tokenExpiresIn,
                isActive: conn.isActive,
                rawConnection: conn
            });
        }

        // Mapear Não Oficiais
        for (const session of unofficialSessions) {
            let status: UnifiedStatus = 'disconnected';
            if (session.status === 'connected' || session.status === 'open') status = 'connected';
            else if (session.status === 'qr') status = 'qr';
            else if (session.status === 'connecting') status = 'verifying';
            else status = 'error';

            items.push({
                id: session.id,
                name: session.name,
                platform: 'evolution',
                status,
                identifier: session.phone,
                createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
                lastConnected: session.lastConnected ? new Date(session.lastConnected) : undefined,
                hasAuth: session.hasAuth,
                rawBaileys: session
            });
        }

        // Ordenar por data de criação (mais recentes primeiro)
        return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }, [officialConnections, unofficialSessions]);

    const isLoading = loadingOfficial || loadingUnofficial;

    // --- Handlers Unificados ---
    const handleDeleteUnified = async () => {
        if (!itemToDelete) return;
        
        if (itemToDelete.platform === 'evolution') {
            await deleteUnofficialSession(itemToDelete.id);
        } else {
            await deleteOfficialConnection(itemToDelete.id);
        }
        
        setItemToDelete(null);
    };

    // Para Baileys, disparar modal de QR Code
    const handleConnectBaileys = async (id: string, name: string) => {
        await reconnectUnofficialSession(id);
        setSelectedSessionId(id);
        setSelectedSessionName(name);
        setQrModalOpen(true);
    };

    const handleSessionCreated = async (id: string, name: string) => {
        if (qrModalOpen && selectedSessionId === id) return;
        setSelectedSessionId(id);
        setSelectedSessionName(name);
        setQrModalOpen(true);
        await reconnectUnofficialSession(id);
    };

    return (
        <div className="space-y-6">
            <TokenAlerts connections={officialConnections} />

            {/* HEADER ACTIONS */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Minhas Conexões</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Visão unificada das suas contas conectadas.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchConnections(true)}
                        disabled={isLoading}
                        className="rounded-xl border border-zinc-200 dark:border-white/5 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleAutoImport}
                        disabled={isImporting}
                        className="w-full sm:w-auto rounded-xl border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
                    >
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" width={16} height={16} alt="FB" className="mr-2" />}
                        Importar do Facebook
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full sm:w-auto rounded-xl border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
                        onClick={async () => {
                            const { dismiss } = toast({ title: "Aguarde", description: "Gerando link de login do Instagram..." });
                            try {
                                const res = await getInstagramAuthUrl();
                                if (res.success && res.url) {
                                    window.location.href = res.url;
                                } else {
                                    toast({ title: "Erro", description: 'Erro ao gerar link: ' + res.error, variant: "destructive" });
                                }
                            } catch (e: any) {
                                toast({ title: "Erro", description: 'Erro: ' + e.message, variant: "destructive" });
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

            {/* <WebhookInfoCard /> */}

            {/* MAIN GRID */}
            <div className="min-h-[300px]">
                {isLoading && unifiedItems.length === 0 ? (
                    <div className="flex items-center justify-center p-16 border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] backdrop-blur-md rounded-[2rem]">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                    </div>
                ) : unifiedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] backdrop-blur-md rounded-[2rem] text-center">
                        <Grid className="h-12 w-12 text-zinc-400 dark:text-zinc-600 mb-4" />
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">Nenhuma conexão ativa</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">Clique em "Nova Conexão" no topo da página para começar.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {unifiedItems.map((item) => (
                            <UnifiedConnectionCard
                                key={item.id}
                                item={item}
                                onCheckHealth={async (conn) => { await refreshSingleConnection(conn.id); }}
                                onSyncWebhook={handleSyncWebhook}
                                onEditMeta={openEditModal}
                                onToggleActive={handleToggleActive}
                                onRenewToken={renewConnectionToken}
                                onConnectBaileys={handleConnectBaileys}
                                onReconnectBaileys={(id) => reconnectUnofficialSession(id)}
                                onResumeBaileys={resumeUnofficialSession}
                                onDisconnectBaileys={(id) => {
                                   toast({ title: "Aviso", description: "Para desconectar, tente reconectar primeiro ou use o aparelho para remover." })
                                }}
                                onDelete={(id, platform) => setItemToDelete({ id, platform })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* MODALS AND DIALOGS */}
            <ImportDialog
                open={isImportModalOpen}
                onOpenChange={setIsImportModalOpen}
                foundConnections={foundConnections}
                logs={importLogs}
                onConfirm={confirmImport}
            />

            <ConnectionDialog
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                editingConnection={editingConnection}
                onSave={handleSaveConnection}
            />

            <CreateSessionDialog 
                onCreateSession={createBaileysSession} 
                onSessionCreated={handleSessionCreated} 
            />

            <QRCodeModal 
                isOpen={qrModalOpen}
                onClose={() => setQrModalOpen(false)}
                sessionId={selectedSessionId}
                sessionName={selectedSessionName}
            />

            {/* DELETE CONFIRMATION */}
            <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
                <AlertDialogContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 shadow-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-900 dark:text-zinc-50">Excluir Conexão?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">
                            Tem certeza que deseja excluir esta conexão? Esta ação removerá a integração permanentemente e não poderá ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-900 dark:text-zinc-300">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUnified} className="bg-rose-600 text-white hover:bg-rose-700">
                            Excluir Conexão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
