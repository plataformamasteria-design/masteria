import { useState, useCallback, useEffect } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ───────────────────────────────────────────────────
export interface WhatsAppConnection {
    id: string;
    organization_id: string;
    instance_name: string | null;
    phone_number: string | null;
    display_name: string | null;
    status: string | null;
    connected_at: string | null;
    created_at: string;
    updated_at: string;
    qr_code: string | null;
    assigned_user_id: string | null;
    assigned_user_ids: string[] | null;
    ghl_user_id: string | null;
    is_default: boolean;
}

interface ConnectionStatus {
    status: 'open' | 'close' | 'connecting' | 'not_found' | 'error' | 'unknown';
    connected: boolean;
}

interface ConnectionData {
    qrcode?: string;
    pairingCode?: string;
}

// ─── Hook ────────────────────────────────────────────────────
export function useMultiWhatsApp() {
    const { currentOrganization } = useOrganization();
    const queryClient = useQueryClient();
    const orgId = currentOrganization?.id;

    // ── Fetch all connections ──
    const {
        data: connections = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['whatsapp-connections', orgId],
        queryFn: async () => {
            if (!orgId) return [];
            // Use a resilient query that works both pre and post migration
            const { data, error } = await (supabase as any)
                .from('whatsapp_connections')
                .select('*')
                .eq('organization_id', orgId)
                .order('created_at', { ascending: true });
            if (error) {
                console.error('Error fetching connections:', error);
                return [];
            }

            let rows = data || [];

            // AUTO-DETECT LEGACY CONNECTION:
            // If whatsapp_connections is empty, check if org has instance_name set
            // and auto-seed the legacy connection into the table
            if (rows.length === 0) {
                const { data: org } = await (supabase as any)
                    .from('organizations')
                    .select('instance_name, slug, name')
                    .eq('id', orgId)
                    .single();

                const legacyInstance = org?.instance_name || org?.slug;
                if (legacyInstance) {
                    console.log('[useMultiWhatsApp] Auto-seeding legacy connection:', legacyInstance);
                    // Insert legacy connection into whatsapp_connections
                    const insertPayload: Record<string, unknown> = {
                        organization_id: orgId,
                        instance_name: legacyInstance,
                        status: 'unknown',
                    };
                    const { data: newRow, error: insertErr } = await (supabase as any)
                        .from('whatsapp_connections')
                        .insert(insertPayload)
                        .select()
                        .single();

                    if (!insertErr && newRow) {
                        // Try to set new columns (display_name, is_default)
                        try {
                            await (supabase as any)
                                .from('whatsapp_connections')
                                .update({
                                    display_name: org?.name || legacyInstance,
                                    is_default: true,
                                })
                                .eq('id', newRow.id);
                        } catch (e) {
                            // columns may not exist yet
                        }
                        rows = [newRow];

                        // Check live status from Evolution API
                        try {
                            const { data: statusData } = await supabase.functions.invoke('evolution-api', {
                                body: {
                                    action: 'status',
                                    organization_id: orgId,
                                },
                            });
                            if (statusData?.status) {
                                await (supabase as any)
                                    .from('whatsapp_connections')
                                    .update({
                                        status: statusData.status,
                                        connected_at: statusData.connected ? new Date().toISOString() : null,
                                    })
                                    .eq('id', newRow.id);
                                rows = [{ ...newRow, status: statusData.status, connected_at: statusData.connected ? new Date().toISOString() : null }];
                            }
                        } catch (e) {
                            console.log('Could not fetch live status:', e);
                        }
                    }
                }
            }

            // Normalize: ensure new columns have defaults even if migration hasn't run
            return rows.map((row: any) => ({
                id: row.id,
                organization_id: row.organization_id,
                instance_name: row.instance_name ?? null,
                phone_number: row.phone_number ?? null,
                display_name: row.display_name ?? row.instance_name ?? null,
                status: row.status ?? 'unknown',
                connected_at: row.connected_at ?? null,
                created_at: row.created_at,
                updated_at: row.updated_at,
                qr_code: row.qr_code ?? null,
                assigned_user_id: row.assigned_user_id ?? null,
                assigned_user_ids: row.assigned_user_ids ?? [],
                ghl_user_id: row.ghl_user_id ?? null,
                is_default: row.is_default ?? true,
            })) as WhatsAppConnection[];
        },
        enabled: !!orgId,
        staleTime: 1000 * 30,
    });

    // ── Setup Realtime Subscription ──
    useEffect(() => {
        if (!orgId) return;

        const channel = supabase.channel(`whatsapp_connections_${orgId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'whatsapp_connections',
                    filter: `organization_id=eq.${orgId}`,
                },
                (payload) => {
                    console.log('Real-time connection update:', payload);
                    queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', orgId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orgId, queryClient]);

    // ── Fetch org members for assignment ──
    const { data: orgMembers = [] } = useQuery({
        queryKey: ['org-members', orgId],
        queryFn: async () => {
            if (!orgId) return [];
            
            // Buscar usuários diretamente do profiles que pertencem à organização
            const { data: profilesData, error } = await (supabase as any)
                .from('profiles')
                .select('id, full_name, avatar_url, email')
                .eq('organization_id', orgId);
                
            if (error) throw error;
            if (!profilesData || profilesData.length === 0) return [];

            const userIds = profilesData.map((p: any) => p.id);

            // Buscar cargos para saber quem é admin (admin ou super_admin)
            const { data: rolesData } = await (supabase as any)
                .from('user_roles')
                .select('user_id, role')
                .in('user_id', userIds);

            return profilesData.map((profile: any) => {
                const userRoles = rolesData?.filter((r: any) => r.user_id === profile.id) || [];
                const isAdmin = userRoles.some((r: any) => r.role === 'admin' || r.role === 'super_admin');
                
                return {
                    id: profile.id,
                    full_name: profile.full_name || profile.email || 'Sem nome',
                    avatar_url: profile.avatar_url,
                    email: profile.email,
                    role: isAdmin ? 'admin' : 'user',
                    is_admin: isAdmin,
                };
            });
        },
        enabled: !!orgId,
        staleTime: 1000 * 60 * 5,
    });

    // ── Fetch GHL users if GHL is connected ──
    const { data: ghlUsers = [], isLoading: isLoadingGhlUsers } = useQuery({
        queryKey: ['ghl-users', orgId],
        queryFn: async () => {
            if (!orgId) return [];
            // Check if GHL is connected
            const { data: conn } = await (supabase as any).from('ghl_connections').select('id').eq('organization_id', orgId).maybeSingle();
            if (!conn) return [];

            try {
                const { data, error } = await supabase.functions.invoke('ghl-sync', {
                    body: { organization_id: orgId, sync_type: 'users' }
                });
                if (error) throw error;
                return (data?.results?.users || []).map((u: any) => ({
                    id: u.id,
                    name: u.name,
                    email: u.email
                }));
            } catch (err) {
                console.error("Error fetching GHL users:", err);
                return [];
            }
        },
        enabled: !!orgId,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    // ── Call Evolution API for a specific connection ──
    const callEvolutionApi = useCallback(
        async (action: string, connectionId?: string, body?: Record<string, unknown>) => {
            if (!orgId) throw new Error('Organization not found');

            const payload: Record<string, unknown> = {
                action,
                organization_id: orgId,
                ...(body || {}),
            };

            // If connectionId is given, we need the instance_name from DB
            if (connectionId) {
                const conn = connections.find((c) => c.id === connectionId);
                if (conn?.instance_name) {
                    payload.instance_name = conn.instance_name;
                }
            }

            const { data, error } = await supabase.functions.invoke('evolution-api', {
                body: payload,
            });

            if (error) {
                const message = (data as any)?.error || error.message || 'API call failed';
                throw new Error(message);
            }
            return data;
        },
        [orgId, connections]
    );

    // ── Create new connection ──
    const createConnection = useCallback(
        async (displayName: string, phoneNumber?: string) => {
            if (!orgId) return;

            try {
                // Generate unique instance name
                const slug = currentOrganization?.slug || orgId.slice(0, 8);
                const suffix = Date.now().toString(36);
                const instanceName = `${slug}_${suffix}`;

                // Insert row in DB — use only guaranteed columns first
                const { data: newConn, error: insertError } = await (supabase as any)
                    .from('whatsapp_connections')
                    .insert({
                        organization_id: orgId,
                        instance_name: instanceName,
                        status: 'close',
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Try to set new columns (may fail if migration not applied)
                try {
                    await (supabase as any)
                        .from('whatsapp_connections')
                        .update({
                            display_name: displayName || `WhatsApp ${connections.length + 1}`,
                            is_default: connections.length === 0,
                        })
                        .eq('id', newConn.id);
                } catch (e) {
                    console.log('New columns not available yet (migration pending):', e);
                }

                // Create instance in Evolution API
                const result = await supabase.functions.invoke('evolution-api', {
                    body: {
                        action: 'create',
                        organization_id: orgId,
                        override_instance_name: instanceName,
                        phoneNumber,
                    },
                });

                if (result.error) {
                    // Rollback DB row
                    await (supabase as any)
                        .from('whatsapp_connections')
                        .delete()
                        .eq('id', newConn.id);
                    throw result.error;
                }

                // If QR code returned, update row
                if (result.data?.qrcode) {
                    await (supabase as any)
                        .from('whatsapp_connections')
                        .update({ qr_code: result.data.qrcode, status: 'connecting' })
                        .eq('id', newConn.id);
                }

                await refetch();
                toast.success(`Conexão "${displayName}" criada! Escaneie o QR Code.`);
                return { ...newConn, qrcode: result.data?.qrcode };
            } catch (error: any) {
                console.error('Error creating connection:', error);
                toast.error(error.message || 'Erro ao criar conexão');
                throw error;
            }
        },
        [orgId, currentOrganization?.slug, connections.length, refetch]
    );

    // ── Delete connection ──
    const deleteConnection = useCallback(
        async (connectionId: string) => {
            const conn = connections.find((c) => c.id === connectionId);
            if (!conn) return;

            try {
                // Delete from Evolution API
                if (conn.instance_name) {
                    try {
                        await supabase.functions.invoke('evolution-api', {
                            body: {
                                action: 'delete',
                                organization_id: orgId,
                                override_instance_name: conn.instance_name,
                            },
                        });
                    } catch (e) {
                        console.log('Evolution delete failed (may not exist):', e);
                    }
                }

                // Delete from DB
                await (supabase as any)
                    .from('whatsapp_connections')
                    .delete()
                    .eq('id', connectionId);

                await refetch();
                toast.success(`Conexão "${conn.display_name || conn.instance_name}" removida`);
            } catch (error: any) {
                console.error('Error deleting connection:', error);
                toast.error(error.message || 'Erro ao remover conexão');
            }
        },
        [orgId, connections, refetch]
    );

    // ── Update connection settings ──
    const updateConnection = useCallback(
        async (connectionId: string, updates: Partial<Pick<WhatsAppConnection, 'display_name' | 'assigned_user_id' | 'assigned_user_ids' | 'ghl_user_id' | 'is_default'>>) => {
            try {
                // If setting as default, unset all others first
                if (updates.is_default) {
                    await (supabase as any)
                        .from('whatsapp_connections')
                        .update({ is_default: false })
                        .eq('organization_id', orgId)
                        .neq('id', connectionId);
                }

                const { error } = await (supabase as any)
                    .from('whatsapp_connections')
                    .update(updates)
                    .eq('id', connectionId);

                if (error) throw error;
                await refetch();
                toast.success('Conexão atualizada!');
            } catch (error: any) {
                console.error('Error updating connection:', error);
                toast.error(error.message || 'Erro ao atualizar conexão');
            }
        },
        [orgId, refetch]
    );

    // ── Check status of a connection ──
    const checkConnectionStatus = useCallback(
        async (connectionId: string): Promise<ConnectionStatus | null> => {
            const conn = connections.find((c) => c.id === connectionId);
            if (!conn?.instance_name) return null;

            try {
                const data = await supabase.functions.invoke('evolution-api', {
                    body: {
                        action: 'status',
                        organization_id: orgId,
                        override_instance_name: conn.instance_name,
                    },
                });

                const result = data.data as ConnectionStatus & { phoneNumber?: string; instanceId?: string; profilePicUrl?: string };

                // Update status + phone_number in DB
                const updatePayload: Record<string, unknown> = {
                    status: result?.status || 'unknown',
                    connected_at: result?.connected ? new Date().toISOString() : null,
                };
                if (result?.phoneNumber) {
                    updatePayload.phone_number = result.phoneNumber;
                }

                await (supabase as any)
                    .from('whatsapp_connections')
                    .update(updatePayload)
                    .eq('id', connectionId);

                await refetch();
                return result;
            } catch (error) {
                console.error('Error checking status:', error);
                return { status: 'error', connected: false };
            }
        },
        [orgId, connections, refetch]
    );

    // ── Get QR code for a connection ──
    const getConnectionQR = useCallback(
        async (connectionId: string): Promise<ConnectionData | null> => {
            const conn = connections.find((c) => c.id === connectionId);
            if (!conn?.instance_name) return null;

            try {
                const { data, error } = await supabase.functions.invoke('evolution-api', {
                    body: {
                        action: 'connect',
                        organization_id: orgId,
                        override_instance_name: conn.instance_name,
                    },
                });

                if (error) throw error;
                return { qrcode: data?.qrcode, pairingCode: data?.pairingCode };
            } catch (error) {
                console.error('Error getting QR:', error);
                return null;
            }
        },
        [orgId, connections]
    );

    // ── Reconnect a connection ──
    const reconnectConnection = useCallback(
        async (connectionId: string, phoneNumber?: string): Promise<ConnectionData | null> => {
            const conn = connections.find((c) => c.id === connectionId);
            if (!conn?.instance_name) return null;

            try {
                const { data, error } = await supabase.functions.invoke('evolution-api', {
                    body: {
                        action: 'reconnect',
                        organization_id: orgId,
                        override_instance_name: conn.instance_name,
                        phoneNumber,
                    },
                });

                if (error) throw error;

                if (data?.qrcode) {
                    await (supabase as any)
                        .from('whatsapp_connections')
                        .update({ qr_code: data.qrcode, status: 'connecting' })
                        .eq('id', connectionId);
                }

                await refetch();
                toast.success('Reconectando...');
                return { qrcode: data?.qrcode, pairingCode: data?.pairingCode };
            } catch (error: any) {
                console.error('Error reconnecting:', error);
                toast.error(error.message || 'Erro ao reconectar');
                return null;
            }
        },
        [orgId, connections, refetch]
    );

    // ── Update connection webhook ──
    const updateConnectionWebhook = useCallback(
        async (connectionId: string): Promise<void> => {
            const conn = connections.find((c) => c.id === connectionId);
            if (!conn?.instance_name) return;

            try {
                const { data, error } = await supabase.functions.invoke('evolution-api', {
                    body: {
                        action: 'update-webhook',
                        organization_id: orgId,
                        override_instance_name: conn.instance_name,
                    },
                });

                if (error) {
                    throw new Error((data as any)?.error || error.message || 'API call failed');
                }

                toast.success('Webhook atualizado com sucesso!');
            } catch (error: any) {
                console.error('Error updating webhook:', error);
                toast.error(error.message || 'Erro ao atualizar webhook');
            }
        },
        [orgId, connections]
    );

    return {
        connections,
        isLoading,
        orgMembers,
        ghlUsers,
        isLoadingGhlUsers,
        refetch,
        createConnection,
        deleteConnection,
        updateConnection,
        checkConnectionStatus,
        getConnectionQR,
        reconnectConnection,
        updateConnectionWebhook,
    };
}
