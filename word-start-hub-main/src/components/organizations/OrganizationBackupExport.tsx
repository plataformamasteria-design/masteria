import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Database, CheckCircle2, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrgOption {
    id: string;
    name: string;
    slug: string;
}

/**
 * Tabelas de dados da organização a serem exportadas, na ordem de dependências FK.
 * Cada entry define: nome da tabela, campos de user reference (para incluir user_name_mapping).
 */
const EXPORT_TABLES = [
    { table: 'profiles', userFields: ['id'] },
    { table: 'user_roles', userFields: ['user_id'] },
    { table: 'user_page_permissions', userFields: ['user_id'] },
    { table: 'teams', userFields: [] },
    { table: 'team_members', userFields: ['user_id'] },
    { table: 'tags', userFields: [] },
    { table: 'funnels', userFields: [] },
    { table: 'chats', userFields: ['assigned_to', 'resolved_by'] },
    { table: 'chat_tags', userFields: [] },
    { table: 'chat_tags_history', userFields: ['assigned_by'] },
    { table: 'chat_assignment_history', userFields: ['assigned_to'] },
    { table: 'chat_reads', userFields: ['user_id'] },
    { table: 'pinned_chats', userFields: ['user_id'] },
    { table: 'pinned_messages', userFields: ['user_id'] },
    { table: 'messages', userFields: ['sent_by'] },
    { table: 'clients', userFields: [] },
    { table: 'transactions', userFields: ['created_by'] },
    { table: 'bot_settings', userFields: [] },
    { table: 'ai_prompts', userFields: ['user_id'] },
    { table: 'system_config', userFields: [] },
    { table: 'analytics_config', userFields: [] },
    { table: 'follow_up_sequences', userFields: [] },
    { table: 'follow_up_sequence_triggers', userFields: [] },
    { table: 'follow_up_steps', userFields: [] },
    { table: 'follow_up_step_messages', userFields: [] },
    { table: 'lead_follow_up_tracking', userFields: [] },
    { table: 'follow_up_queue', userFields: [] },
    { table: 'follow_up_webhook_log', userFields: [] },
    { table: 'calendars', userFields: ['created_by'] },
    { table: 'calendar_events', userFields: ['user_id', 'assigned_to'] },
    { table: 'google_calendar_config', userFields: [] },
    { table: 'booking_config', userFields: [] },
    { table: 'bookings', userFields: [] },
    { table: 'slash_commands', userFields: ['created_by'] },
    { table: 'slash_command_steps', userFields: [] },
    { table: 'slash_command_executions', userFields: ['executed_by'] },
    { table: 'scheduled_messages', userFields: ['created_by'] },
    { table: 'tasks', userFields: ['user_id', 'assigned_to'] },
    { table: 'organization_auto_messages', userFields: [] },
    { table: 'group_participants', userFields: [] },
] as const;

/**
 * Busca todos os registros de uma tabela filtrando por organization_id,
 * usando paginação para não estourar o limite da API.
 */
async function fetchAllFromTable(table: string, orgId: string): Promise<any[]> {
    const PAGE_SIZE = 1000;
    const allData: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await (supabase as any)
            .from(table)
            .select('*')
            .eq('organization_id', orgId)
            .range(offset, offset + PAGE_SIZE - 1)
            .order('created_at', { ascending: true });

        if (error) {
            // Tabela pode não existir ou não ter organization_id — ignorar
            if (error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
                return [];
            }
            console.warn(`[Export] Erro ao buscar ${table}:`, error.message);
            return allData;
        }

        if (data && data.length > 0) {
            allData.push(...data);
            offset += PAGE_SIZE;
            hasMore = data.length === PAGE_SIZE;
        } else {
            hasMore = false;
        }
    }

    return allData;
}

export function OrganizationBackupExport() {
    const [organizations, setOrganizations] = useState<OrgOption[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTable, setCurrentTable] = useState('');
    const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);

    // Carregar lista de organizações
    useEffect(() => {
        const loadOrgs = async () => {
            const { data } = await supabase
                .from('organizations')
                .select('id, name, slug')
                .order('name');
            if (data) {
                setOrganizations(data);
            }
            setIsLoadingOrgs(false);
        };
        loadOrgs();
    }, []);

    const handleExport = async () => {
        if (!selectedOrgId) {
            toast.error('Selecione uma organização');
            return;
        }

        setIsExporting(true);
        setProgress(0);
        setCurrentTable('Iniciando...');

        try {
            const org = organizations.find(o => o.id === selectedOrgId);
            if (!org) throw new Error('Organização não encontrada');

            // 1. Buscar dados da organização
            setCurrentTable('Organização');
            const { data: orgData } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', selectedOrgId)
                .single();

            // 2. Buscar todas as tabelas
            const exportData: Record<string, any[]> = {};
            const totalTables = EXPORT_TABLES.length;
            const userIds = new Set<string>();

            for (let i = 0; i < EXPORT_TABLES.length; i++) {
                const { table, userFields } = EXPORT_TABLES[i];
                setCurrentTable(table);
                setProgress(Math.round(((i + 1) / totalTables) * 85));

                const data = await fetchAllFromTable(table, selectedOrgId);
                exportData[table] = data;

                // Coletar user IDs para o user_name_mapping
                for (const row of data) {
                    for (const field of userFields) {
                        if (row[field] && typeof row[field] === 'string') {
                            userIds.add(row[field]);
                        }
                    }
                }
            }

            // 3. Buscar auth_users dos profiles encontrados
            setCurrentTable('Auth users...');
            setProgress(88);
            const profileEmails = (exportData.profiles || []).map((p: any) => p.email).filter(Boolean);
            const authUsers: any[] = [];

            if (profileEmails.length > 0) {
                // Buscar via admin API usando listUsers e filtrando
                const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
                if (listData?.users) {
                    for (const user of listData.users) {
                        if (profileEmails.includes(user.email)) {
                            authUsers.push({
                                id: user.id,
                                email: user.email,
                                full_name: user.user_metadata?.full_name || '',
                                email_confirmed_at: user.email_confirmed_at,
                                created_at: user.created_at,
                                last_sign_in_at: user.last_sign_in_at,
                                user_metadata: user.user_metadata,
                                app_metadata: user.app_metadata,
                                identities: user.identities,
                            });
                        }
                    }
                }
            }

            // 4. Construir user_name_mapping
            setCurrentTable('Finalizando...');
            setProgress(92);
            const userNameMapping: Record<string, string> = {};
            for (const profile of (exportData.profiles || [])) {
                userNameMapping[profile.id] = profile.full_name || profile.email || profile.id;
            }

            // Adicionar _assigned_to_name nos chats para referência
            const chatsWithNames = (exportData.chats || []).map((chat: any) => ({
                ...chat,
                _assigned_to_name: chat.assigned_to ? (userNameMapping[chat.assigned_to] || null) : null,
            }));

            // 5. Montar o JSON final (formato flat idêntico ao backup-abreu-e-rios.json)
            const backup = {
                organization_id: selectedOrgId,
                exported_at: new Date().toISOString(),
                organization: orgData,
                profiles: exportData.profiles || [],
                auth_users: authUsers,
                user_roles: exportData.user_roles || [],
                user_page_permissions: exportData.user_page_permissions || [],
                teams: exportData.teams || [],
                team_members: exportData.team_members || [],
                tags: exportData.tags || [],
                funnels: exportData.funnels || [],
                chats: chatsWithNames,
                chat_tags: exportData.chat_tags || [],
                chat_tags_history: exportData.chat_tags_history || [],
                chat_assignment_history: exportData.chat_assignment_history || [],
                chat_reads: exportData.chat_reads || [],
                pinned_chats: exportData.pinned_chats || [],
                pinned_messages: exportData.pinned_messages || [],
                messages: exportData.messages || [],
                clients: exportData.clients || [],
                transactions: exportData.transactions || [],
                bot_settings: exportData.bot_settings || [],
                ai_prompts: exportData.ai_prompts || [],
                system_config: exportData.system_config || [],
                analytics_config: exportData.analytics_config || [],
                follow_up_sequences: exportData.follow_up_sequences || [],
                follow_up_sequence_triggers: exportData.follow_up_sequence_triggers || [],
                follow_up_steps: exportData.follow_up_steps || [],
                follow_up_step_messages: exportData.follow_up_step_messages || [],
                lead_follow_up_tracking: exportData.lead_follow_up_tracking || [],
                follow_up_queue: exportData.follow_up_queue || [],
                follow_up_webhook_log: exportData.follow_up_webhook_log || [],
                calendars: exportData.calendars || [],
                calendar_events: exportData.calendar_events || [],
                google_calendar_config: exportData.google_calendar_config || [],
                booking_config: exportData.booking_config || [],
                bookings: exportData.bookings || [],
                slash_commands: exportData.slash_commands || [],
                slash_command_steps: exportData.slash_command_steps || [],
                slash_command_executions: exportData.slash_command_executions || [],
                scheduled_messages: exportData.scheduled_messages || [],
                tasks: exportData.tasks || [],
                organization_auto_messages: exportData.organization_auto_messages || [],
                group_participants: exportData.group_participants || [],
                user_name_mapping: userNameMapping,
                _summary: {
                    profiles: (exportData.profiles || []).length,
                    auth_users: authUsers.length,
                    user_roles: (exportData.user_roles || []).length,
                    user_page_permissions: (exportData.user_page_permissions || []).length,
                    teams: (exportData.teams || []).length,
                    team_members: (exportData.team_members || []).length,
                    tags: (exportData.tags || []).length,
                    funnels: (exportData.funnels || []).length,
                    chats: chatsWithNames.length,
                    chat_tags: (exportData.chat_tags || []).length,
                    messages: (exportData.messages || []).length,
                    calendars: (exportData.calendars || []).length,
                    transactions: (exportData.transactions || []).length,
                    follow_up_sequences: (exportData.follow_up_sequences || []).length,
                    slash_commands: (exportData.slash_commands || []).length,
                    group_participants: (exportData.group_participants || []).length,
                },
            };

            // 6. Download
            setProgress(98);
            const jsonStr = JSON.stringify(backup, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${org.slug}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setProgress(100);
            setCurrentTable('Concluído!');
            toast.success(`Backup exportado: ${org.name} (${(jsonStr.length / 1024 / 1024).toFixed(1)} MB)`);
        } catch (error: any) {
            console.error('[Export] Erro:', error);
            toast.error('Erro na exportação: ' + error.message);
        } finally {
            setTimeout(() => {
                setIsExporting(false);
                setProgress(0);
                setCurrentTable('');
            }, 2000);
        }
    };

    const selectedOrg = organizations.find(o => o.id === selectedOrgId);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Exportar Backup
                </CardTitle>
                <CardDescription>
                    Gere um backup JSON completo de uma organização com todos os dados, usuários e configurações
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId} disabled={isExporting}>
                        <SelectTrigger className="flex-1">
                            <Building2 className="h-4 w-4 mr-2 opacity-50" />
                            <SelectValue placeholder={isLoadingOrgs ? "Carregando..." : "Selecione a organização"} />
                        </SelectTrigger>
                        <SelectContent>
                            {organizations.map(org => (
                                <SelectItem key={org.id} value={org.id}>
                                    <span className="font-medium">{org.name}</span>
                                    <span className="text-muted-foreground text-xs ml-2">({org.slug})</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        onClick={handleExport}
                        disabled={!selectedOrgId || isExporting}
                        className="gap-2 min-w-[180px]"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Exportando...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                Exportar Backup
                            </>
                        )}
                    </Button>
                </div>

                {/* Progress */}
                {isExporting && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-2">
                                {progress === 100 ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Database className="h-4 w-4 animate-pulse" />
                                )}
                                {currentTable}
                            </span>
                            <span className="font-mono text-xs">{progress}%</span>
                        </div>
                        <Progress value={progress} />
                    </div>
                )}

                {/* Selected org info */}
                {selectedOrg && !isExporting && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30 border border-white/5">
                        <Database className="h-3.5 w-3.5" />
                        <span>
                            O backup incluirá <strong>todos os dados</strong> da organização
                            <Badge variant="outline" className="ml-2 text-[10px]">{selectedOrg.slug}</Badge>,
                            incluindo chats, mensagens, tags, equipes, configurações e perfis de usuários.
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
