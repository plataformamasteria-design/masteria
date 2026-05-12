import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload, FileJson, AlertTriangle, CheckCircle2, Loader2, Database,
  Users, MessageSquare, Tag, Calendar, Zap, Settings, CreditCard, Bot, Info, UserPlus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────

interface RestoreLog {
  table: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  message: string;
  count?: number;
}

interface UserMapping {
  oldId: string;
  email: string;
  fullName: string;
  existsInSystem: boolean;
  newId: string | null;
  shouldImport: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────

const BATCH_SIZE = 500;
const UPDATE_BATCH_SIZE = 100;
const TEMP_PASSWORD = 'MudarSenha@2026!';

/** Fields that reference user IDs and need remapping */
const USER_REFERENCE_FIELDS: Record<string, string[]> = {
  chats: ['assigned_to', 'resolved_by'],
  messages: ['sent_by'],
  slash_commands: ['created_by'],
  calendar_events: ['user_id', 'assigned_to'],
  ai_prompts: ['user_id'],
  chat_assignment_history: ['assigned_to'],
  chat_tags_history: ['assigned_by'],
  calendars: ['created_by'],
  tasks: ['user_id', 'assigned_to'],
  scheduled_messages: ['created_by'],
  slash_command_executions: ['executed_by'],
  transactions: ['created_by'],
  team_members: ['user_id'],
  chat_reads: ['user_id'],
  profiles: ['id'],
  user_roles: ['user_id'],
  user_page_permissions: ['user_id'],
};

/** Tables that reference chats (need chat FK) */
const TABLES_WITH_CHAT_FK = [
  'messages', 'chat_tags', 'chat_tags_history', 'chat_assignment_history',
  'chat_reads', 'slash_command_executions', 'tasks', 'scheduled_messages',
  'pinned_chats', 'pinned_messages', 'group_participants',
];

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Detects if backup is in flat format (our export) vs nested format (old Lovable).
 * Flat format has arrays like chats, messages, tags at root level.
 */
function isFlatFormat(data: any): boolean {
  return Array.isArray(data.chats) && Array.isArray(data.messages) && data.organization_id;
}

/**
 * Normalize backup data: extract org_id, org_name and build a
 * standardized table-data map regardless of format.
 */
function normalizeBackup(raw: any): {
  orgId: string;
  orgName: string;
  orgSlug: string;
  organization: any;
  tables: Record<string, any[]>;
  profiles: any[];
  authUsers: any[];
  userNameMapping: Record<string, string>;
} {
  if (isFlatFormat(raw)) {
    // Flat format (backup-abreu-e-rios.json style)
    const orgId = raw.organization_id;
    const org = raw.organization || {};
    return {
      orgId,
      orgName: org.name || raw.meta?.organization_name || 'Desconhecida',
      orgSlug: org.slug || raw.meta?.organization_slug || '',
      organization: org,
      profiles: raw.profiles || [],
      authUsers: raw.auth_users || [],
      userNameMapping: raw.user_name_mapping || {},
      tables: {
        organizations: org.id ? [org] : [],
        tags: raw.tags || [],
        funnels: raw.funnels || [],
        teams: raw.teams || [],
        team_members: raw.team_members || [],
        chats: (raw.chats || []).map((c: any) => { const { _assigned_to_name, ...rest } = c; return rest; }),
        messages: raw.messages || [],
        chat_tags: raw.chat_tags || [],
        chat_tags_history: raw.chat_tags_history || [],
        chat_assignment_history: raw.chat_assignment_history || [],
        chat_reads: raw.chat_reads || [],
        group_participants: raw.group_participants || [],
        bot_settings: raw.bot_settings || [],
        organization_auto_messages: raw.organization_auto_messages || [],
        follow_up_sequences: raw.follow_up_sequences || [],
        follow_up_sequence_triggers: raw.follow_up_sequence_triggers || [],
        follow_up_steps: raw.follow_up_steps || [],
        follow_up_step_messages: raw.follow_up_step_messages || [],
        lead_follow_up_tracking: raw.lead_follow_up_tracking || [],
        follow_up_queue: raw.follow_up_queue || [],
        follow_up_webhook_log: raw.follow_up_webhook_log || [],
        calendars: raw.calendars || [],
        calendar_events: raw.calendar_events || [],
        google_calendar_config: raw.google_calendar_config || [],
        booking_config: raw.booking_config || [],
        bookings: raw.bookings || [],
        slash_commands: raw.slash_commands || [],
        slash_command_steps: raw.slash_command_steps || [],
        slash_command_executions: raw.slash_command_executions || [],
        scheduled_messages: raw.scheduled_messages || [],
        tasks: raw.tasks || [],
        transactions: raw.transactions || [],
        clients: raw.clients || [],
        ai_prompts: raw.ai_prompts || [],
        system_config: raw.system_config || [],
        analytics_config: raw.analytics_config || [],
        profiles: raw.profiles || [],
        user_roles: raw.user_roles || [],
        user_page_permissions: raw.user_page_permissions || [],
      },
    };
  }

  // Nested format (old Lovable export)
  const meta = raw.meta || {};
  const orgId = meta.organization_id || '';
  return {
    orgId,
    orgName: meta.organization_name || 'Desconhecida',
    orgSlug: meta.organization_slug || '',
    organization: raw.organization?.info || {},
    profiles: raw.profiles || [],
    authUsers: raw.auth_users || [],
    userNameMapping: raw.user_name_mapping || {},
    tables: {
      organizations: raw.organization?.info ? [raw.organization.info] : [],
      tags: raw.tags || [],
      funnels: raw.funnels || [],
      teams: raw.teams || [],
      team_members: raw.team_members || [],
      chats: raw.chats || [],
      messages: raw.messages || [],
      chat_tags: raw.chat_relations?.chat_tags || raw.chat_tags || [],
      chat_tags_history: raw.chat_relations?.chat_tags_history || raw.chat_tags_history || [],
      chat_assignment_history: raw.chat_relations?.chat_assignment_history || raw.chat_assignment_history || [],
      chat_reads: raw.chat_relations?.chat_reads || raw.chat_reads || [],
      group_participants: raw.chat_relations?.group_participants || raw.group_participants || [],
      bot_settings: raw.organization?.bot_settings ? [raw.organization.bot_settings] : [],
      organization_auto_messages: raw.organization?.auto_messages ? [raw.organization.auto_messages] : [],
      follow_up_sequences: raw.follow_up?.sequences || raw.follow_up_sequences || [],
      follow_up_sequence_triggers: raw.follow_up?.triggers || raw.follow_up_sequence_triggers || [],
      follow_up_steps: raw.follow_up?.steps || raw.follow_up_steps || [],
      follow_up_step_messages: raw.follow_up?.step_messages || raw.follow_up_step_messages || [],
      lead_follow_up_tracking: raw.chat_relations?.lead_follow_up_tracking || [],
      follow_up_queue: raw.chat_relations?.follow_up_queue || [],
      follow_up_webhook_log: [],
      calendars: raw.agenda?.calendars || raw.calendars || [],
      calendar_events: raw.agenda?.events || raw.calendar_events || [],
      google_calendar_config: raw.organization?.google_calendar_config || [],
      booking_config: raw.agenda?.booking_config ? [raw.agenda.booking_config] : [],
      bookings: raw.agenda?.bookings || [],
      slash_commands: raw.commands?.slash_commands || raw.slash_commands || [],
      slash_command_steps: raw.commands?.steps || raw.slash_command_steps || [],
      slash_command_executions: raw.chat_relations?.slash_command_executions || [],
      scheduled_messages: raw.chat_relations?.scheduled_messages || [],
      tasks: raw.agenda?.tasks || raw.tasks || [],
      transactions: raw.financeiro?.transactions || raw.transactions || [],
      clients: raw.financeiro?.clients || raw.clients || [],
      ai_prompts: raw.ai_prompts || [],
      system_config: raw.organization?.system_config ? [raw.organization.system_config] : [],
      analytics_config: raw.analytics_config ? [raw.analytics_config] : [],
      profiles: raw.profiles || [],
      user_roles: raw.user_roles || [],
      user_page_permissions: raw.user_page_permissions || [],
    },
  };
}

// ── Main Component ─────────────────────────────────────────────────────

export function BackupRestore() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [normalized, setNormalized] = useState<ReturnType<typeof normalizeBackup> | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreLogs, setRestoreLogs] = useState<RestoreLog[]>([]);
  const [userMappings, setUserMappings] = useState<UserMapping[]>([]);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [importNewUsers, setImportNewUsers] = useState(true);

  // ── File Upload ──

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      toast.error('Por favor, selecione um arquivo JSON válido');
      return;
    }
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const data = normalizeBackup(raw);

      if (!data.orgId) {
        toast.error('Arquivo de backup inválido: organization_id ausente');
        return;
      }

      // Build user mappings
      await buildUserMappings(data);

      setNormalized(data);
      setRestoreLogs([]);
      setRestoreProgress(0);
      toast.success(`Backup carregado: ${data.orgName}`);
    } catch (error) {
      console.error('Error parsing backup:', error);
      toast.error('Erro ao ler arquivo de backup');
    }
  };

  // ── Build User Mappings ──

  const buildUserMappings = async (data: ReturnType<typeof normalizeBackup>) => {
    const profiles = data.profiles || [];
    if (profiles.length === 0) { setUserMappings([]); return; }

    // Fetch existing auth users
    const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
    const existingUsers = authData?.users || [];
    const emailToId: Record<string, string> = {};
    for (const u of existingUsers) {
      if (u.email) emailToId[u.email.toLowerCase()] = u.id;
    }

    const mappings: UserMapping[] = profiles.map((p: any) => {
      const email = (p.email || '').toLowerCase();
      const existsInSystem = !!emailToId[email];
      return {
        oldId: p.id,
        email: p.email || '',
        fullName: p.full_name || p.email || '',
        existsInSystem,
        newId: existsInSystem ? emailToId[email] : null,
        shouldImport: !existsInSystem,
      };
    });

    setUserMappings(mappings);

    // If there are new users, show the dialog
    const newUsers = mappings.filter(m => !m.existsInSystem);
    if (newUsers.length > 0) {
      setShowUserDialog(true);
    }
  };

  // ── Helpers ──

  const addLog = (log: RestoreLog) => setRestoreLogs(prev => [...prev, log]);
  const updateLog = (table: string, updates: Partial<RestoreLog>) => {
    setRestoreLogs(prev => prev.map(l => l.table === table ? { ...l, ...updates } : l));
  };

  const remap = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const mapping = userMappings.find(m => m.oldId === id);
    if (mapping) return mapping.newId || mapping.oldId;
    return id;
  };

  const remapUserFields = (tableName: string, rows: any[]): any[] => {
    const fields = USER_REFERENCE_FIELDS[tableName];
    if (!fields) return rows;
    return rows.map(row => {
      const cleaned = { ...row };
      for (const field of fields) {
        if (cleaned[field]) {
          const newId = remap(cleaned[field]);
          // If user doesn't exist and wasn't imported, null it out
          if (newId && userMappings.find(m => m.oldId === cleaned[field] && !m.existsInSystem && !m.shouldImport)) {
            cleaned[field] = null;
          } else {
            cleaned[field] = newId;
          }
        }
      }
      return cleaned;
    });
  };

  const upsertBatch = async (table: string, data: any[], conflictColumn = 'id'): Promise<number> => {
    if (!data || data.length === 0) return 0;
    let processed = 0;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const { error } = await (supabase as any).from(table).upsert(batch, { onConflict: conflictColumn });
      if (error) {
        // Try one by one
        for (const item of batch) {
          const { error: e2 } = await (supabase as any).from(table).upsert(item, { onConflict: conflictColumn });
          if (!e2) processed++;
        }
      } else {
        processed += batch.length;
      }
    }
    return processed;
  };

  // Two-phase message import to handle quoted_message_id FK
  const restoreMessages = async (messages: any[]): Promise<{ inserted: number; quotesUpdated: number }> => {
    if (!messages || messages.length === 0) return { inserted: 0, quotesUpdated: 0 };

    const quotedMap = new Map<string, string>();
    messages.forEach(msg => {
      if (msg.quoted_message_id) quotedMap.set(msg.id, msg.quoted_message_id);
    });

    // Phase 1: insert without quoted_message_id
    const withoutQuotes = messages.map(msg => ({ ...msg, quoted_message_id: null }));
    const remapped = remapUserFields('messages', withoutQuotes);
    const insertedCount = await upsertBatch('messages', remapped);

    // Phase 2: update quoted_message_id
    let quotesUpdated = 0;
    const entries = Array.from(quotedMap.entries());
    for (let i = 0; i < entries.length; i += UPDATE_BATCH_SIZE) {
      const batch = entries.slice(i, i + UPDATE_BATCH_SIZE);
      const promises = batch.map(async ([msgId, quotedId]) => {
        const { error } = await (supabase as any).from('messages').update({ quoted_message_id: quotedId }).eq('id', msgId);
        return error ? 0 : 1;
      });
      const results = await Promise.all(promises);
      quotesUpdated += results.reduce((s, r) => s + r, 0);
    }

    return { inserted: insertedCount, quotesUpdated };
  };

  // ── Main Restore ──

  const handleRestore = async () => {
    if (!normalized) return;

    const confirmed = window.confirm(
      `⚠️ ATENÇÃO!\n\nVocê está prestes a restaurar o backup da organização "${normalized.orgName}".\n\n` +
      `Isso irá SUBSTITUIR todos os dados existentes desta organização.\n\n` +
      (userMappings.filter(m => m.existsInSystem).length > 0
        ? `✅ ${userMappings.filter(m => m.existsInSystem).length} usuários já existem e serão preservados com IDs remapeados.\n`
        : '') +
      (importNewUsers && userMappings.filter(m => !m.existsInSystem && m.shouldImport).length > 0
        ? `👤 ${userMappings.filter(m => !m.existsInSystem && m.shouldImport).length} novos usuários serão criados com senha temporária.\n`
        : '') +
      `\nDeseja continuar?`
    );

    if (!confirmed) return;

    setIsRestoring(true);
    setRestoreProgress(0);
    setRestoreLogs([]);

    const { orgId, tables } = normalized;

    try {
      // Phase 0: Import new users if requested
      const newUsersToImport = userMappings.filter(m => !m.existsInSystem && m.shouldImport);
      if (importNewUsers && newUsersToImport.length > 0) {
        addLog({ table: 'Novos Usuários', status: 'processing', message: `Criando ${newUsersToImport.length} usuários...` });

        let created = 0;
        for (const mapping of newUsersToImport) {
          const { data: userData, error: authErr } = await supabase.auth.admin.createUser({
            id: mapping.oldId,
            email: mapping.email,
            password: TEMP_PASSWORD,
            email_confirm: true,
            user_metadata: {
              full_name: mapping.fullName,
              email: mapping.email,
              email_verified: true,
              phone_verified: false,
            },
          });

          if (authErr) {
            console.warn(`Erro ao criar user ${mapping.email}:`, authErr.message);
          } else {
            mapping.newId = userData.user.id;
            mapping.existsInSystem = true;
            created++;
          }
        }

        updateLog('Novos Usuários', {
          status: 'success',
          message: `${created}/${newUsersToImport.length} usuários criados (senha: ${TEMP_PASSWORD})`,
          count: created,
        });
      }

      // Phase 1: Clean existing data
      addLog({ table: 'Limpeza', status: 'processing', message: 'Removendo dados antigos...' });

      const cleanOrder = [
        'follow_up_webhook_log', 'follow_up_queue', 'lead_follow_up_tracking',
        'follow_up_step_messages', 'follow_up_steps', 'follow_up_sequence_triggers', 'follow_up_sequences',
        'slash_command_executions', 'slash_command_steps', 'slash_commands',
        'scheduled_messages', 'tasks',
        'chat_reads', 'chat_assignment_history', 'chat_tags_history', 'chat_tags',
        'messages', 'group_participants', 'bookings', 'booking_config',
        'google_calendar_config', 'calendar_events', 'calendars',
        'transactions', 'clients', 'chats', 'tags', 'funnels',
        'team_members', 'teams', 'organization_auto_messages', 'bot_settings',
        'user_page_permissions', 'user_roles', 'profiles',
      ];

      let cleaned = 0;
      for (const table of cleanOrder) {
        const { error } = await (supabase as any).from(table).delete().eq('organization_id', orgId);
        if (!error) cleaned++;
      }
      updateLog('Limpeza', { status: 'success', message: `${cleaned} tabelas limpas` });

      // Phase 2: Insert data in FK order
      const insertOrder: { name: string; displayName: string; isMessages?: boolean }[] = [
        { name: 'organizations', displayName: 'Organização' },
        { name: 'profiles', displayName: 'Perfis' },
        { name: 'user_roles', displayName: 'Papéis' },
        { name: 'user_page_permissions', displayName: 'Permissões' },
        { name: 'tags', displayName: 'Tags' },
        { name: 'funnels', displayName: 'Funis' },
        { name: 'teams', displayName: 'Equipes' },
        { name: 'team_members', displayName: 'Membros de Equipe' },
        { name: 'bot_settings', displayName: 'Config. Bot' },
        { name: 'organization_auto_messages', displayName: 'Mensagens Auto' },
        { name: 'calendars', displayName: 'Calendários' },
        { name: 'calendar_events', displayName: 'Eventos' },
        { name: 'booking_config', displayName: 'Config. Agendamento' },
        { name: 'bookings', displayName: 'Agendamentos' },
        { name: 'follow_up_sequences', displayName: 'Sequências Follow-up' },
        { name: 'follow_up_sequence_triggers', displayName: 'Gatilhos Follow-up' },
        { name: 'follow_up_steps', displayName: 'Etapas Follow-up' },
        { name: 'follow_up_step_messages', displayName: 'Msgs Follow-up' },
        { name: 'slash_commands', displayName: 'Comandos' },
        { name: 'slash_command_steps', displayName: 'Etapas Comando' },
        { name: 'chats', displayName: 'Chats (Leads)' },
        { name: 'messages', displayName: 'Mensagens', isMessages: true },
        { name: 'chat_tags', displayName: 'Tags de Chat' },
        { name: 'chat_tags_history', displayName: 'Histórico Tags' },
        { name: 'chat_assignment_history', displayName: 'Histórico Atribuição' },
        { name: 'chat_reads', displayName: 'Leituras' },
        { name: 'group_participants', displayName: 'Participantes Grupo' },
        { name: 'slash_command_executions', displayName: 'Execuções Comando' },
        { name: 'scheduled_messages', displayName: 'Msgs Agendadas' },
        { name: 'lead_follow_up_tracking', displayName: 'Tracking Follow-up' },
        { name: 'follow_up_queue', displayName: 'Fila Follow-up' },
        { name: 'transactions', displayName: 'Transações' },
        { name: 'clients', displayName: 'Clientes' },
        { name: 'tasks', displayName: 'Tarefas' },
        { name: 'system_config', displayName: 'Config. Sistema' },
        { name: 'analytics_config', displayName: 'Config. Analytics' },
      ];

      const tablesWithData = insertOrder.filter(t => (tables[t.name]?.length || 0) > 0);
      let completed = 0;

      for (const tableInfo of insertOrder) {
        const data = tables[tableInfo.name];
        if (!data || data.length === 0) continue;

        addLog({ table: tableInfo.displayName, status: 'processing', message: `${data.length} registros...` });

        try {
          if (tableInfo.isMessages) {
            // Two-phase message import
            const remapped = remapUserFields('messages', data);
            const { inserted, quotesUpdated } = await restoreMessages(remapped);
            updateLog(tableInfo.displayName, {
              status: 'success',
              message: `${inserted} msgs (${quotesUpdated} com citações)`,
              count: inserted,
            });
          } else {
            const remapped = remapUserFields(tableInfo.name, data);
            const count = await upsertBatch(tableInfo.name, remapped);
            updateLog(tableInfo.displayName, {
              status: count === data.length ? 'success' : 'error',
              message: `${count}/${data.length} registros`,
              count,
            });
          }
        } catch (error: any) {
          updateLog(tableInfo.displayName, { status: 'error', message: error.message });
        }

        completed++;
        setRestoreProgress(Math.round((completed / tablesWithData.length) * 100));
      }

      toast.success('Restauração concluída! Verifique os logs.');
    } catch (error: any) {
      console.error('Restore error:', error);
      toast.error('Erro na restauração: ' + error.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const resetUpload = () => {
    setNormalized(null);
    setRestoreLogs([]);
    setRestoreProgress(0);
    setUserMappings([]);
    setShowUserDialog(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Computed ──

  const existingUsers = userMappings.filter(m => m.existsInSystem);
  const newUsers = userMappings.filter(m => !m.existsInSystem);

  const counts = normalized ? {
    chats: normalized.tables.chats?.length || 0,
    messages: normalized.tables.messages?.length || 0,
    tags: normalized.tables.tags?.length || 0,
    profiles: normalized.profiles?.length || 0,
    teams: normalized.tables.teams?.length || 0,
    commands: normalized.tables.slash_commands?.length || 0,
    followUp: normalized.tables.follow_up_sequences?.length || 0,
    calendars: normalized.tables.calendars?.length || 0,
    transactions: normalized.tables.transactions?.length || 0,
  } : null;

  // ── Render ──

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Restaurar Backup
        </CardTitle>
        <CardDescription>
          Faça upload de um arquivo de backup JSON para restaurar dados de uma organização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area */}
        {!normalized && (
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileJson className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Clique para selecionar arquivo</p>
            <p className="text-sm text-muted-foreground">ou arraste e solte aqui</p>
            <p className="text-xs text-muted-foreground mt-2">Aceita arquivos .json</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Backup Info */}
        {normalized && counts && (
          <div className="space-y-4">
            <Alert>
              <FileJson className="h-4 w-4" />
              <AlertTitle>Backup Carregado</AlertTitle>
              <AlertDescription>
                <strong>{normalized.orgName}</strong> ({normalized.orgSlug})
              </AlertDescription>
            </Alert>

            {/* User Mapping Info */}
            {userMappings.length > 0 && (
              <Alert className="border-blue-500/20 bg-blue-500/5">
                <Users className="h-4 w-4 text-blue-500" />
                <AlertTitle>Mapeamento de Usuários</AlertTitle>
                <AlertDescription className="text-sm space-y-2">
                  {existingUsers.length > 0 && (
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      <strong>{existingUsers.length}</strong> usuários já existem → IDs serão remapeados automaticamente
                    </p>
                  )}
                  {newUsers.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-2">
                        <UserPlus className="h-3.5 w-3.5 text-amber-500" />
                        <strong>{newUsers.length}</strong> novos usuários encontrados
                      </p>
                      <div className="flex items-center gap-2 pl-5">
                        <Checkbox
                          id="import-users"
                          checked={importNewUsers}
                          onCheckedChange={(checked) => setImportNewUsers(checked === true)}
                        />
                        <label htmlFor="import-users" className="text-xs cursor-pointer">
                          Importar novos usuários (senha temporária: <code className="bg-muted px-1 rounded">{TEMP_PASSWORD}</code>)
                        </label>
                      </div>
                      {importNewUsers && (
                        <div className="pl-5 space-y-1">
                          {newUsers.map(u => (
                            <div key={u.oldId} className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <UserPlus className="h-3 w-3" />
                              {u.fullName} <span className="opacity-60">({u.email})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Counts Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <MessageSquare className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{counts.chats}</p>
                <p className="text-xs text-muted-foreground">Chats</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <MessageSquare className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{counts.messages.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Mensagens</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Tag className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{counts.tags}</p>
                <p className="text-xs text-muted-foreground">Tags</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{counts.profiles}</p>
                <p className="text-xs text-muted-foreground">Usuários</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{counts.teams}</p>
                <p className="text-xs text-muted-foreground">Equipes</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{counts.followUp}</p>
                <p className="text-xs text-muted-foreground">Sequências</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{counts.commands}</p>
                <p className="text-xs text-muted-foreground">Comandos</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <CreditCard className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{counts.transactions}</p>
                <p className="text-xs text-muted-foreground">Transações</p>
              </div>
            </div>

            {/* Warning */}
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                A restauração irá <strong>substituir todos os dados</strong> existentes desta organização.
                Certifique-se de fazer um export antes de restaurar.
              </AlertDescription>
            </Alert>

            {/* Progress */}
            {isRestoring && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso da restauração</span>
                  <span>{restoreProgress}%</span>
                </div>
                <Progress value={restoreProgress} />
              </div>
            )}

            {/* Logs */}
            {restoreLogs.length > 0 && (
              <ScrollArea className="h-64 rounded-lg border p-3">
                <div className="space-y-2">
                  {restoreLogs.map((log, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {log.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {log.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {log.status === 'error' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {log.status === 'skipped' && <Info className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium">{log.table}:</span>
                      <span className={
                        log.status === 'error' ? 'text-destructive' :
                          log.status === 'skipped' ? 'text-muted-foreground italic' :
                            'text-muted-foreground'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={handleRestore} disabled={isRestoring} className="flex-1">
                {isRestoring ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Restaurando...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />Iniciar Restauração</>
                )}
              </Button>
              <Button variant="outline" onClick={resetUpload} disabled={isRestoring}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
