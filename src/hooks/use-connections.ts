
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { toggleConnectionActive, checkConnectionStatus } from '@/app/actions';
import { importFacebookConnections, saveImportedConnections } from '@/app/actions/meta-import';
import type { Connection, HealthStatus } from '@/components/settings/connections/types';


export function useConnections() {
    // Force Rebuild 2
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    const [loading, setLoading] = useState(true);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [isSyncingWebhook, setIsSyncingWebhook] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [foundConnections, setFoundConnections] = useState<any[]>([]);
    const [importLogs, setImportLogs] = useState<string[]>([]); // New State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingConnection, setEditingConnection] = useState<Connection | null>(null);

    // Ref to access current connections inside callbacks without dependency loops
    const connectionsRef = useRef(connections);
    useEffect(() => {
        connectionsRef.current = connections;
    }, [connections]);

    // --- Helpers (Defined first to be used by main functions) ---

    const checkWebhookStatus = useCallback(async (connectionId: string): Promise<void> => {
        const conn = connectionsRef.current.find(c => c.id === connectionId);
        const connectionType = conn?.connectionType || '';

        // Skip for Baileys, WhatsMeow, and Evolution
        if (connectionType === 'baileys' || connectionType === 'whatsmeow' || connectionType === 'evolution') {
            setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, webhookStatus: 'N/A' } : c));
            return;
        }

        setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, webhookStatus: 'VERIFICANDO' } : c));

        try {
            const res = await fetch(`/api/v1/connections/${connectionId}/webhook-status`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Falha ao verificar status do webhook.");
            setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, webhookStatus: data.status } : c));
        } catch (error) {
            setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, webhookStatus: 'ERRO' } : c));
            console.error(`Erro ao verificar webhook para conexão ${connectionId}:`, error);
        }
    }, []);

    const checkHmacHealth = useCallback(async (connectionId: string): Promise<void> => {
        setConnections(prev => prev.map(c => c.id === connectionId ? {
            ...c,
            hmacHealth: { status: 'loading', successRate: null, lastValidatedAt: null, lastError: null }
        } : c));
        try {
            const res = await fetch(`/api/v1/connections/${connectionId}/webhook-health`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Falha ao verificar saúde HMAC.");

            setConnections(prev => prev.map(c => c.id === connectionId ? {
                ...c,
                hmacHealth: {
                    status: data.status,
                    successRate: data.successRate,
                    lastValidatedAt: data.lastValidatedAt,
                    lastError: data.lastError,
                }
            } : c));
        } catch (error) {
            console.error(`Erro ao verificar HMAC para conexão ${connectionId}:`, error);
            setConnections(prev => prev.map(c => c.id === connectionId ? {
                ...c,
                hmacHealth: { status: 'error', successRate: null, lastValidatedAt: null, lastError: 'Falha na verificação' }
            } : c));
        }
    }, []);

    // --- Health & Single Refresh (Independent) ---

    // Moved checkConnectionHealth UP, as it is used by fetchConnections (conceptually) 
    // or simply needs to be defined
    const checkConnectionHealth = useCallback(async (force: boolean = false): Promise<void> => {
        try {
            const res = await fetch(`/api/v1/connections/health${force ? '?force=true' : ''}`);
            if (!res.ok) throw new Error('Falha ao verificar saúde das conexões.');
            const data = await res.json();

            setConnections(prev => prev.map(conn => {
                const healthData = data.connections.find((h: any) => h.id === conn.id);
                if (healthData) {
                    const updated = {
                        ...conn,
                        healthStatus: healthData.status,
                        healthErrorMessage: healthData.errorMessage,
                        tokenExpiresIn: healthData.tokenExpiresIn,
                        lastHealthCheck: new Date(healthData.lastChecked)
                    };
                    // For Baileys/Evolution: derive connectionStatus from health (no Meta API involved)
                    if (conn.connectionType === 'baileys' || conn.connectionType === 'evolution') {
                        updated.connectionStatus = healthData.status === 'healthy' ? 'Conectado' : 'Falha na Conexão';
                        updated.webhookStatus = 'N/A';
                    }
                    return updated;
                }
                return conn;
            }));
        } catch (error) {
            console.error('Erro ao verificar saúde das conexões:', error);
        }
    }, []);

    const refreshSingleConnection = useCallback(async (connectionId: string) => {
        const conn = connectionsRef.current.find(c => c.id === connectionId);

        // Baileys/Evolution: use health API instead of Meta Graph API check
        if (conn?.connectionType === 'baileys' || conn?.connectionType === 'evolution') {
            try {
                const res = await fetch(`/api/v1/connections/health?force=true`);
                if (res.ok) {
                    const data = await res.json();
                    const healthData = data.connections.find((h: any) => h.id === connectionId);
                    if (healthData) {
                        const status = healthData.status === 'healthy' ? 'Conectado' : 'Falha na Conexão';
                        setConnections(prev => prev.map(c => c.id === connectionId ? {
                            ...c,
                            connectionStatus: status,
                            healthStatus: healthData.status,
                            healthErrorMessage: healthData.errorMessage,
                            webhookStatus: 'N/A',
                        } : c));
                    }
                }
            } catch (err) {
                console.error(`[useConnections] Error refreshing Baileys ${connectionId}:`, err);
            }
            return;
        }

        // Meta API connections: existing logic
        await Promise.all([
            checkConnectionStatus(connectionId),
            checkWebhookStatus(connectionId),
            checkHmacHealth(connectionId),
        ]).then(([connStatusRes]) => {
            setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, connectionStatus: connStatusRes.success ? 'Conectado' : 'Falha na Conexão' } : c));
        });
    }, [checkWebhookStatus, checkHmacHealth]);

    // --- Main Fetch (Depends on checkConnectionHealth & refreshSingleConnection) ---

    const fetchConnections = useCallback(async (force: boolean = false): Promise<void> => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/connections');
            if (!res.ok) throw new Error('Falha ao carregar conexões.');
            const data = await res.json();

            const now = new Date();
            const initialConnections = data.map((c: any) => {
                let healthStatus = 'healthy' as HealthStatus;
                let tokenExpiresIn = 60;

                if (c.tokenExpiresAt) {
                    const expiresAt = new Date(c.tokenExpiresAt);
                    const diffTime = expiresAt.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    tokenExpiresIn = diffDays;

                    if (diffDays < 0) {
                        healthStatus = 'expired';
                    } else if (diffDays <= 7) {
                        healthStatus = 'expiring_soon';
                    }
                }

                return {
                    ...c,
                    connectionStatus: 'Não Verificado',
                    webhookStatus: 'VERIFICANDO', // Initial status before background check
                    healthStatus,
                    tokenExpiresIn
                };
            });

            // avoid double set if empty
            if (initialConnections.length === 0) {
                setConnections([]);
                setLoading(false);
                return;
            }

            setConnections(initialConnections);

            // Background checks - Refresh everything automatically on load
            // 1. Check general health (token validity)
            await checkConnectionHealth(force);

            // 2. Trigger individual status/webhook refreshes without blocking the main UI
            initialConnections.forEach((c: Connection) => {
                refreshSingleConnection(c.id).catch(err => {
                    console.error(`[useConnections] Error background refreshing ${c.id}:`, err);
                });
            });

        } catch (error) {
            notify.error('Erro', (error as Error).message);
        } finally {
            setLoading(false);
        }
    }, [notify, checkConnectionHealth, refreshSingleConnection]);

    // --- Main Actions (Depends on fetchConnections) ---

    const renewConnectionToken = useCallback(async (connectionId: string): Promise<void> => {
        try {
            const res = await fetch(`/api/v1/connections/${connectionId}/refresh-token`, {
                method: 'POST'
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Falha ao renovar token.");

            notify.success('Token Renovado', 'O token de acesso foi renovado com sucesso.');

            // Update local state with new token metadata
            if (data.data) {
                setConnections(prev => prev.map(c => c.id === connectionId ? {
                    ...c,
                    tokenExpiresAt: data.data.tokenExpiresAt,
                    tokenLastRefreshed: data.data.tokenLastRefreshed,
                    tokenType: data.data.tokenType,
                    // Re-calculate health
                    healthStatus: 'healthy',
                    // Rough update, real update happens on next fetch
                    tokenExpiresIn: 60
                } : c));
            } else {
                // Formatting fallback if data missing
                fetchConnections();
            }
        } catch (error) {
            notify.error('Erro na Renovação', (error as Error).message);
            throw error;
        }
    }, [notify, fetchConnections]);

    // --- Other Actions ---

    const handleAutoImport = async () => {
        setIsImporting(true);
        setImportLogs([]); // Clear previous logs
        try {
            const result = await importFacebookConnections();

            // Capture Logs
            if (result.diagnosticLogs) {
                setImportLogs(result.diagnosticLogs);
            }

            if (result.success && result.connections) {
                if (result.connections.length === 0) {
                    notify.info('Nenhuma Conexão Encontrada', 'Não encontramos contas do WhatsApp Business associadas ao seu usuário do Facebook.');
                    // Still show modal if we have logs, so user can see WHY (e.g. permissions missing)
                    if (result.diagnosticLogs && result.diagnosticLogs.length > 0) {
                        setIsImportModalOpen(true);
                    }
                } else {
                    setFoundConnections(result.connections);
                    setIsImportModalOpen(true);
                }
            } else {
                notify.error('Erro na Importação', result.error || 'Falha desconhecida.');
                // Also show logs on error if available
                if (result.diagnosticLogs && result.diagnosticLogs.length > 0) {
                    setIsImportModalOpen(true);
                }
            }
        } catch (error) {
            notify.error('Erro', 'Ocorreu um erro ao tentar importar do Facebook.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleToggleActive = async (connectionId: string, newIsActive: boolean): Promise<void> => {
        const originalConnections = [...connections];
        setConnections((prev) =>
            prev.map((conn) => conn.id === connectionId ? { ...conn, isActive: newIsActive } : conn)
        );

        try {
            await toggleConnectionActive(connectionId, newIsActive);
        } catch (error) {
            notify.error('Erro', 'Não foi possível alterar o status da conexão.');
            setConnections(originalConnections);
        }
    };

    const handleDelete = async (connectionId: string): Promise<void> => {
        const originalConnections = [...connections];
        setConnections(prev => prev.filter(c => c.id !== connectionId));
        try {
            const response = await fetch(`/api/v1/connections/${connectionId}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao excluir a conexão.');
            }
            notify.success('Conexão Excluída', 'A conexão foi removida com sucesso.');
        } catch (error) {
            notify.error('Erro ao Excluir', error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
            setConnections(originalConnections);
        }
    };

    const handleSyncWebhook = async (connectionId: string): Promise<void> => {
        setIsSyncingWebhook(connectionId);
        try {
            const response = await fetch(`/api/v1/connections/${connectionId}/configure-webhook`, {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha desconhecida ao configurar o webhook.');

            notify.success('Webhook Sincronizado!', data.message || 'A configuração do webhook foi sincronizada com sucesso.');
            await checkWebhookStatus(connectionId);
        } catch (error) {
            notify.error('Erro na Sincronização', (error as Error).message);
        } finally {
            setIsSyncingWebhook(null);
        }
    };

    // --- Baileys Actions ---

    const connectBaileys = async (connectionId: string, action: 'resume' | 'reconnect'): Promise<void> => {
        try {
            const res = await fetch(`/api/v1/whatsapp/sessions/${connectionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Falha ao ${action === 'resume' ? 'resumir' : 'reconectar'} sessão.`);
            }

            notify.success('Comando Enviado', `Solicitação de ${action === 'resume' ? 'conexão' : 'reconexão'} enviada.`);
            // Optimistic update
            setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, connectionStatus: 'Não Verificado' } : c));
            // Trigger fetch to update status
            setTimeout(() => fetchConnections(), 2000);
        } catch (error) {
            notify.error('Erro', (error as Error).message);
        }
    };

    const disconnectBaileys = async (connectionId: string): Promise<void> => {
        try {
            const res = await fetch(`/api/v1/whatsapp/sessions/${connectionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'disconnect' }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Falha ao desconectar sessão.');
            }

            notify.success('Desconectado', 'Sessão desconectada com sucesso.');
            // Optimistic update
            setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, connectionStatus: 'Falha na Conexão', baileysStatus: 'disconnected' } : c));
            setTimeout(() => fetchConnections(), 1000);
        } catch (error) {
            notify.error('Erro', (error as Error).message);
        }
    };

    // --- Save/Edit ---
    const openEditModal = async (connection: Connection) => {
        try {
            // Optional: fetch fresh details first if needed, though usually list has enough
            // But let's follow original logic if it fetched full details including secrets (which list api excludes usually)
            const response = await fetch(`/api/v1/connections/${connection.id}`);
            if (!response.ok) throw new Error('Não foi possível obter detalhes.');
            const fullData = await response.json();

            setEditingConnection(fullData);
            setIsEditModalOpen(true);
        } catch (error) {
            notify.error('Erro', 'Erro ao carregar detalhes para edição.');
        }
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingConnection(null);
    };

    const handleSaveConnection = async (formData: FormData): Promise<void> => {
        const connectionData = {
            configName: formData.get('configName') as string,
            connectionType: formData.get('connectionType') as string,
            wabaId: formData.get('wabaId') as string,
            phoneNumberId: formData.get('phoneNumberId') as string,
            appId: formData.get('appId') as string,
            accessToken: formData.get('accessToken') as string,
            appSecret: formData.get('appSecret') as string,
        };

        const isEditing = !!editingConnection?.id;
        const url = isEditing ? `/api/v1/connections/${editingConnection.id}` : '/api/v1/connections';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(connectionData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao salvar a conexão.');
            }

            notify.success(`Conexão ${isEditing ? 'Atualizada' : 'Salva'}!`, `A conexão foi salva com sucesso.`);
            closeEditModal();
            fetchConnections();

        } catch (error) {
            notify.error('Erro ao Salvar', error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
        }
    };

    // --- Import ---

    const confirmImport = async () => {
        try {
            const result = await saveImportedConnections(foundConnections);
            if (result.success) {
                notify.success('Importação Concluída', `${result.count} novas conexões foram adicionadas.`);
                setIsImportModalOpen(false);
                fetchConnections();
            } else {
                notify.error('Erro ao Salvar', result.error || 'Falha ao salvar conexões.');
            }
        } catch (error) {
            notify.error('Erro', 'Falha ao processar a importação.');
        }
    };


    // Auto-refresh interval - increased to 1 hour to dramatically reduce Meta API quota usage
    useEffect(() => {
        fetchConnections();
        const healthCheckInterval = setInterval(checkConnectionHealth, 60 * 60 * 1000);
        return () => clearInterval(healthCheckInterval);
    }, [fetchConnections, checkConnectionHealth]);

    return {
        // State
        connections,
        loading,
        isSyncingWebhook,
        isImporting,
        importLogs, // Expose Logs

        // Modals state
        isEditModalOpen,
        setIsEditModalOpen: (open: boolean) => !open ? closeEditModal() : setIsEditModalOpen(true),
        editingConnection,
        openEditModal,

        isImportModalOpen,
        setIsImportModalOpen,
        foundConnections,

        // Actions
        fetchConnections,
        handleToggleActive,
        handleDelete,
        handleSyncWebhook,
        handleSaveConnection,
        handleAutoImport,
        confirmImport,
        checkConnectionHealth,
        refreshSingleConnection,
        renewConnectionToken,
        connectBaileys,
        disconnectBaileys
    };
}
