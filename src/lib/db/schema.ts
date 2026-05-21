

import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  unique,
  primaryKey,
  jsonb,
  decimal,
  numeric,
  integer,
  pgEnum,
  date,
  time,
  customType,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

// ==============================
// TIPOS E INTERFACES
// ==============================

export type KanbanStage = {
  id: string;
  title: string;
  type: 'NEUTRAL' | 'WIN' | 'LOSS';
  semanticType?: 'meeting_scheduled' | 'meeting_cancelled' | 'payment_received' | 'proposal_sent';
  externalId?: string;
};

export type MetaHandle = {
  wabaId: string;
  handle: string;
  createdAt: string;
};

export const userRoleEnum = pgEnum('user_role', ['admin', 'atendente', 'superadmin']);

export const notificationTypeEnum = pgEnum('notification_type', [
  'daily_report',
  'weekly_report',
  'biweekly_report',
  'monthly_report',
  'biannual_report',
  'new_meeting',
  'new_sale',
  'campaign_sent',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'skipped',
  'retried',
]);

export type AutomationCondition = {
  id?: string;
  type: 'contact_tag' | 'message_content' | 'contact_list' | 'conversation_status';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'exists' | 'not_exists';
  value: string | number | null;
}

export type AutomationAction = {
  id?: string;
  type: 'send_message' | 'send_message_apicloud' | 'send_message_baileys' | 'add_tag' | 'add_to_list' | 'assign_user' | 'move_to_stage';
  value: string;
  connectionId?: string;
  templateId?: string;
}

// ==============================
// TABELAS PRINCIPAIS
// ==============================

export const companies = pgTable('companies', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull().unique(),
  avatarUrl: text('avatar_url'),
  website: text('website'),
  addressStreet: text('address_street'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressZipCode: text('address_zip_code'),
  country: text('country'),
  webhookSlug: text('webhook_slug').unique().default(sql`gen_random_uuid()`),
  mksmsApiToken: text('mksms_api_token'),
  aiKnowledgeBase: text('ai_knowledge_base'),
  aiModel: varchar('ai_model', { length: 255 }),
  defaultKanbanBoardId: text('default_kanban_board_id'),
  trialEndsAt: timestamp('trial_ends_at'),
  lifetime: boolean('lifetime').default(false).notNull(),
  isStarred: boolean('is_starred').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const companyQuotas = pgTable('company_quotas', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  maxMessagesPerMonth: integer('max_messages_per_month').default(1000).notNull(),
  maxContacts: integer('max_contacts').default(500).notNull(),
  maxAiTokens: integer('max_ai_tokens').default(100000).notNull(),
  maxConnections: integer('max_connections').default(5).notNull(),
  currentMessagesMonth: integer('current_messages_month').default(0).notNull(),
  currentAiTokensMonth: integer('current_ai_tokens_month').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const systemSettings = pgTable('system_settings', {
  id: text('id').primaryKey().default('global'),
  openaiApiKey: text('openai_api_key'),
  geminiApiKey: text('gemini_api_key'),
  elevenlabsApiKey: text('elevenlabs_api_key'),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const companyCredentials = pgTable('company_credentials', {
  companyId: text('company_id').primaryKey().notNull().references(() => companies.id, { onDelete: 'cascade' }),
  openaiApiKey: text('openai_api_key'),
  geminiApiKey: text('gemini_api_key'),
  elevenlabsApiKey: text('elevenlabs_api_key'),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const companyFinancials = pgTable('company_financials', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  monthlyFee: decimal('monthly_fee', { precision: 10, scale: 2 }).default('0').notNull(),
  implementationFee: decimal('implementation_fee', { precision: 10, scale: 2 }).default('0').notNull(),
  fixedCosts: decimal('fixed_costs', { precision: 10, scale: 2 }).default('0').notNull(),
  variableCosts: decimal('variable_costs', { precision: 10, scale: 2 }).default('0').notNull(),
  paymentDay: integer('payment_day').default(10).notNull(),
  lastPaymentDate: timestamp('last_payment_date'),
  totalPaid: decimal('total_paid', { precision: 10, scale: 2 }).default('0').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const users = pgTable('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  avatarUrl: text('avatar_url'),
  password: text('password'),
  firebaseUid: varchar('firebase_uid', { length: 255 }).unique(),
  role: userRoleEnum('role').notNull(),
  companyId: text('company_id').references(() => companies.id),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  googleId: varchar('google_id', { length: 255 }).unique(),
  facebookId: varchar('facebook_id', { length: 255 }).unique(),
  googleAccessToken: text('google_access_token'),
  facebookAccessToken: text('facebook_access_token'),
  permissions: jsonb('permissions').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastResendAt: timestamp("last_resend_at", { withTimezone: true })
});

export const teams = pgTable('teams', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const usersToTeams = pgTable('users_to_teams', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.teamId] }),
}));

export const connections = pgTable('connections', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id),
  config_name: text('config_name').notNull(),
  connectionType: text('connection_type').default('meta_api').notNull(),
  sessionName: text('session_name'),
  wahaUrl: text('waha_url'),
  wahaStatus: text('waha_status'),
  phoneNumber: text('phone_number'),

  wabaId: text('waba_id'),
  phoneNumberId: text('phone_number_id'),
  appId: text('app_id'),
  accessToken: text('access_token'),
  webhookSecret: text('webhook_secret'),
  appSecret: text('app_secret').default(''),

  sessionId: text('session_id'),
  phone: text('phone'),
  qrCode: text('qr_code'),
  status: text('status'),
  lastConnected: timestamp('last_connected'),

  isActive: boolean('is_active').default(false).notNull(),
  assignedPersonaId: text('assigned_persona_id').references(() => aiPersonas.id, { onDelete: 'set null' }),
  environment: text('environment').default('production'),

  // Token Management Fields
  tokenType: text('token_type'), // 'short_lived' | 'long_lived' | 'system_user'
  tokenExpiresAt: timestamp('token_expires_at'),
  tokenLastRefreshed: timestamp('token_last_refreshed'),
  tokenRefreshFailedAt: timestamp('token_refresh_failed_at'),
  tokenRefreshError: text('token_refresh_error'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS connections_company_status_idx ON ${table} (company_id, status)`,
  companyActiveIdx: sql`CREATE INDEX IF NOT EXISTS connections_company_active_idx ON ${table} (company_id, is_active) WHERE is_active = true`,
  companyTypeIdx: sql`CREATE INDEX IF NOT EXISTS connections_company_type_idx ON ${table} (company_id, connection_type)`,
}));

export const baileysAuthState = pgTable('baileys_auth_state', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  creds: jsonb('creds'),
  keys: jsonb('keys'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const baileysMessages = pgTable('baileys_messages', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  connectionId: text('connection_id').notNull(),
  conversationId: text('conversation_id'),
  jid: text('jid').notNull(),
  messageId: text('message_id').notNull().unique(),
  fromMe: boolean('from_me').default(false).notNull(),
  timestamp: integer('timestamp'),
  text: text('text'),
  content: jsonb('content'),
}, (table) => ({
  jidTimestampIdx: sql`CREATE INDEX IF NOT EXISTS idx_baileys_msgs_jid_timestamp ON ${table} (jid, timestamp DESC)`,
  convTimestampIdx: sql`CREATE INDEX IF NOT EXISTS idx_baileys_msgs_conv_timestamp ON ${table} (conversation_id, timestamp DESC)`,
}));

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id).notNull(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const webhooks = pgTable('webhooks', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  eventTriggers: text('event_triggers').array().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const webhookLogs = pgTable('webhook_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id).notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tags = pgTable('tags', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  nameCompanyUnique: unique('tags_name_company_id_unique').on(table.name, table.companyId),
}));

export const contactLists = pgTable('contact_lists', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  filters: jsonb('filters'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  nameCompanyUnique: unique('contact_lists_name_company_id_unique').on(table.name, table.companyId),
}));

export const contacts = pgTable('contacts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  whatsappName: text('whatsapp_name'),
  phone: varchar('phone', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }),
  avatarUrl: text('avatar_url'),
  status: text('status').default('ACTIVE').notNull(),
  isGroup: boolean('is_group').default(false).notNull(),
  notes: text('notes'),
  customFields: jsonb('custom_fields').$type<Record<string, string>>(),
  profileLastSyncedAt: timestamp('profile_last_synced_at'),
  addressStreet: text('address_street'),
  addressNumber: text('address_number'),
  addressComplement: text('address_complement'),
  addressDistrict: text('address_district'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  addressZipCode: text('address_zip_code'),
  externalId: text('external_id'),
  externalProvider: text('external_provider'),
  createdAt: timestamp('created_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Neurolinguistic Profiling Fields
  vakProfile: text('vak_profile').default('UNKNOWN'), // VISUAL, AUDITORY, KINESTHETIC, MIXED
  dominantSocialNeed: text('dominant_social_need'), // SIGNIFICANCE, ACCEPTANCE, APPROVAL, INTELLIGENCE, PITY, POWER
  communicationPace: text('communication_pace').default('MODERATE'), // FAST, MODERATE, SLOW
  lastPsychographicUpdate: timestamp('last_psychographic_update'),
}, (table) => ({
  phoneCompanyUnique: unique('contacts_phone_company_id_unique').on(table.phone, table.companyId),
  externalIdProviderUnique: unique('contacts_external_id_provider_unique').on(table.externalId, table.externalProvider),
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS contacts_company_status_idx ON ${table} (company_id, status) WHERE deleted_at IS NULL`,
  companyCreatedAtIdx: sql`CREATE INDEX IF NOT EXISTS contacts_company_created_at_idx ON ${table} (company_id, created_at DESC) WHERE deleted_at IS NULL`,
  companyPhoneIdx: sql`CREATE INDEX IF NOT EXISTS contacts_company_phone_idx ON ${table} (company_id, phone) WHERE deleted_at IS NULL`,
}));

export const contactsToTags = pgTable('contacts_to_tags', {
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.contactId, t.tagId] }),
}));

export const contactsToContactLists = pgTable('contacts_to_contact_lists', {
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  listId: text('list_id').notNull().references(() => contactLists.id, { onDelete: 'cascade' }),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.contactId, t.listId] }),
}));

// ==============================
// AUTOMATIONS & AI
// ==============================

export const automationRules = pgTable('automation_rules', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  triggerEvent: text('trigger_event').notNull(),
  conditions: jsonb('conditions').$type<AutomationCondition[]>().notNull(),
  conditionLogic: text('condition_logic').$type<'AND' | 'OR'>().default('AND').notNull(), // NEW: How to evaluate multiple conditions
  actions: jsonb('actions').$type<AutomationAction[]>().notNull(),
  connectionIds: text('connection_ids').array(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyActiveIdx: sql`CREATE INDEX IF NOT EXISTS automation_rules_company_active_idx ON ${table} (company_id, is_active) WHERE is_active = true`,
  companyTriggerIdx: sql`CREATE INDEX IF NOT EXISTS automation_rules_company_trigger_idx ON ${table} (company_id, trigger_event)`,
}));

export const automationLogs = pgTable('automation_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  ruleId: text('rule_id').references(() => automationRules.id, { onDelete: 'set null' }),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  level: text('level').notNull(),
  message: text('message').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  companyCreatedAtIdx: sql`CREATE INDEX IF NOT EXISTS automation_logs_company_created_at_idx ON ${table} (company_id, created_at DESC)`,
  companyRuleIdx: sql`CREATE INDEX IF NOT EXISTS automation_logs_company_rule_idx ON ${table} (company_id, rule_id) WHERE rule_id IS NOT NULL`,
}));

export const aiCredentials = pgTable('ai_credentials', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  provider: text('provider').notNull().$type<'OPENROUTER' | 'GEMINI'>(),
  apiKey: text('api_key').notNull(), // This will be encrypted
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export type AgentResource = {
  id: string;
  name: string;
  type: 'LINK' | 'PIX' | 'TEXT' | 'IMAGE';
  content: string;
  description?: string;
  isActive: boolean;
};

export const agentTypeEnum = pgEnum('agent_type', [
  'GENERAL', 'ATENDIMENTO', 'SDR', 'VENDAS', 'ONBOARDING', 'RELATOR', 'ABORDAGEM'
]);

export const aiPersonas = pgTable('ai_personas', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  agentType: agentTypeEnum('agent_type').default('GENERAL').notNull(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt'),
  provider: text('provider').notNull().$type<'GEMINI'>(),
  model: text('model').notNull(), // e.g., 'gemini-2.0-flash-exp'
  credentialId: text('credential_id').references(() => aiCredentials.id, { onDelete: 'set null' }),
  temperature: decimal('temperature', { precision: 3, scale: 2 }).default('0.7').notNull(),
  topP: decimal('top_p', { precision: 3, scale: 2 }).default('0.9').notNull(),
  maxOutputTokens: integer('max_output_tokens').default(2048),
  mcpServerUrl: text('mcp_server_url'),
  mcpServerHeaders: jsonb('mcp_server_headers').$type<Record<string, string>>(),
  triggerKeywords: text('trigger_keywords').array(),
  isTriggerActive: boolean('is_trigger_active').default(false).notNull(),
  useRag: boolean('use_rag').default(false).notNull(),
  resources: jsonb('resources').$type<AgentResource[]>().default([]),
  variables: jsonb('variables').$type<Record<string, string>>().default({}),
  behaviorPresets: jsonb('behavior_presets').$type<{
    useAbbreviations: boolean;
    maxEmojisPerMessage: number;
    boldSingleCTA: boolean;
    variedGreetings: string[];
    splitResources: boolean;
  }>().default({
    useAbbreviations: true,
    maxEmojisPerMessage: 2,
    boldSingleCTA: true,
    variedGreetings: ["Boa", "Show", "Entendi", "Certo", "Bora", "Combinado"],
    splitResources: true
  }),
  audioMode: text('audio_mode').$type<'text' | 'audio' | 'both'>().default('text').notNull(),
  audioModeEnabled: boolean('audio_mode_enabled').default(false).notNull(),
  voiceProvider: text('voice_provider').$type<'gemini' | 'elevenlabs'>().default('gemini').notNull(),
  voiceSettings: jsonb('voice_settings').$type<{
    voiceId: string;
    speed: number;
    stability?: number;
    similarityBoost?: number; // Para ElevenLabs
    style?: number;           // Para ElevenLabs
    useSpeakerBoost?: boolean;// Para ElevenLabs
    modelId?: string;         // Para ElevenLabs (v2, v2.5 turbo/flash)
  }>().default({
    voiceId: 'Aoede',
    speed: 1.0,
    stability: 0.5
  }),
  firstResponseMinDelay: integer('first_response_min_delay').default(33).notNull(),
  firstResponseMaxDelay: integer('first_response_max_delay').default(68).notNull(),
  followupResponseMinDelay: integer('followup_response_min_delay').default(81).notNull(),
  followupResponseMaxDelay: integer('followup_response_max_delay').default(210).notNull(),
  // Configurações de Follow-up Automático (cadência de mensagens)
  followupEnabled: boolean('followup_enabled').default(false).notNull(),
  followupMode: text('followup_mode').$type<'minutes' | 'daily'>().default('minutes').notNull(),
  followupDelayMinutes: integer('followup_delay_minutes').default(30).notNull(),
  followupDaysCount: integer('followup_days_count').default(7).notNull(),
  followupMaxAttempts: integer('followup_max_attempts').default(3).notNull(),
  followupMessages: jsonb('followup_messages').$type<string[]>().default([
    "Oi! Vi que você não respondeu... tudo bem por aí? 😊",
    "Ei, ainda está aí? Posso ajudar em algo mais?",
    "Última mensagem: se precisar, é só chamar! 🙌"
  ]),
  // Agendamento via Google Calendar
  enableScheduling: boolean('enable_scheduling').default(true).notNull(),
  schedulingPrompt: text('scheduling_prompt'), // Prompt customizável para agendamento
  // Lembrete de reunião via WhatsApp
  meetingReminderEnabled: boolean('meeting_reminder_enabled').default(false).notNull(),
  meetingReminderMinutes: integer('meeting_reminder_minutes').default(30).notNull(), // 5, 30, ou 60
  // Funil Kanban associado (roteamento automático de leads)
  kanbanBoardId: text('kanban_board_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const personaPromptSections = pgTable('persona_prompt_sections', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  personaId: text('persona_id').notNull().references(() => aiPersonas.id, { onDelete: 'cascade' }),
  sectionName: text('section_name').notNull(),
  content: text('content').notNull(),
  language: text('language').notNull().default('all'),
  priority: integer('priority').default(0).notNull(),
  tags: text('tags').array(),
  isActive: boolean('is_active').default(true).notNull(),
  externalSourceId: text('external_source_id'), // Reference to external source that generated this section
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// External data sources for RAG (Google Sheets, PDF, CSV, Websites)
export const sourceTypeEnum = pgEnum('source_type', [
  'google_sheets',
  'pdf',
  'csv',
  'website'
]);

export const syncStatusEnum = pgEnum('sync_status', [
  'pending',
  'syncing',
  'synced',
  'error'
]);

export const personaExternalSources = pgTable('persona_external_sources', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  personaId: text('persona_id').notNull().references(() => aiPersonas.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sourceType: sourceTypeEnum('source_type').notNull(),
  sourceUrl: text('source_url'), // For Google Sheets and websites
  s3Key: text('s3_key'), // For uploaded PDFs and CSVs
  originalFileName: text('original_file_name'), // Original filename for uploads
  extractedContent: text('extracted_content'), // Cached raw content
  syncStatus: syncStatusEnum('sync_status').default('pending').notNull(),
  syncError: text('sync_error'),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  personaIdx: sql`CREATE INDEX IF NOT EXISTS persona_external_sources_persona_idx ON ${table} (persona_id)`,
  companyIdx: sql`CREATE INDEX IF NOT EXISTS persona_external_sources_company_idx ON ${table} (company_id)`,
}));

// ==============================
// CONVERSATIONS & MESSAGES
// ==============================

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').references(() => connections.id, { onDelete: 'set null' }),
  status: text('status').default('NEW').notNull(),
  assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  aiActive: boolean('ai_active').default(true).notNull(),
  assignedPersonaId: text('assigned_persona_id').references(() => aiPersonas.id, { onDelete: 'set null' }),
  lastAutoResponseAt: timestamp('last_auto_response_at'),
  contactType: text('contact_type').default('PASSIVE').notNull(),
  source: text('source'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  archivedAt: timestamp('archived_at'),
  archivedBy: text('archived_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS conversations_company_status_idx ON ${table} (company_id, status) WHERE archived_at IS NULL`,
  companyLastMessageAtIdx: sql`CREATE INDEX IF NOT EXISTS conversations_company_last_message_at_idx ON ${table} (company_id, last_message_at DESC) WHERE archived_at IS NULL`,
  companyUpdatedAtIdx: sql`CREATE INDEX IF NOT EXISTS conversations_company_updated_at_idx ON ${table} (company_id, updated_at DESC) WHERE archived_at IS NULL`,
  companyContactIdx: sql`CREATE INDEX IF NOT EXISTS conversations_company_contact_idx ON ${table} (company_id, contact_id) WHERE archived_at IS NULL`,
}));

export const messages = pgTable('messages', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').references(() => connections.id, { onDelete: 'set null' }),
  providerMessageId: text('provider_message_id').unique(),
  repliedToMessageId: text('replied_to_message_id'),
  senderType: text('sender_type').notNull(),
  senderId: text('sender_id'),
  content: text('content').notNull(),
  contentType: text('content_type').default('TEXT').notNull(),
  mediaUrl: text('media_url'),
  status: text('status'),
  failureReason: text('failure_reason'),
  isAiGenerated: boolean('is_ai_generated'),
  aiTranscription: text('ai_transcription'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  readAt: timestamp('read_at'),
}, (table) => ({
  companySentAtIdx: sql`CREATE INDEX IF NOT EXISTS messages_company_sent_at_idx ON ${table} (company_id, sent_at DESC) WHERE company_id IS NOT NULL`,
  companyConversationIdx: sql`CREATE INDEX IF NOT EXISTS messages_company_conversation_idx ON ${table} (company_id, conversation_id) WHERE company_id IS NOT NULL`,
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS messages_company_status_idx ON ${table} (company_id, status) WHERE company_id IS NOT NULL AND status IS NOT NULL`,
}));

export const messageReactions = pgTable('message_reactions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  reactorPhone: text('reactor_phone').notNull(),
  reactorName: text('reactor_name'),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueReaction: unique().on(table.messageId, table.reactorPhone),
}));

// ==============================
// KANBAN / CRM
// ==============================

export const kanbanBoards = pgTable('kanban_boards', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  funnelType: text('funnel_type').default('GENERAL'),
  objective: text('objective'),
  stages: jsonb('stages').$type<KanbanStage[]>().notNull(),
  connectionIds: text('connection_ids').array(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const kanbanLeads = pgTable('kanban_leads', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  boardId: text('board_id').notNull().references(() => kanbanBoards.id, { onDelete: 'cascade' }),
  stageId: text('stage_id').notNull(),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  title: text('title'),
  notes: text('notes'),
  value: decimal('value', { precision: 10, scale: 2 }).default('0').notNull(),
  currentStage: jsonb('current_stage').$type<KanbanStage>(),
  lastStageChangeAt: timestamp('last_stage_change_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
  externalId: text('external_id'),
  externalProvider: text('external_provider'),
  status: text('status').default('ACTIVE').notNull(),
}, (table) => ({
  companyBoardIdx: sql`CREATE INDEX IF NOT EXISTS kanban_leads_company_board_idx ON ${table} (company_id, board_id)`,
  companyStageIdx: sql`CREATE INDEX IF NOT EXISTS kanban_leads_company_stage_idx ON ${table} (company_id, stage_id)`,
  companyContactIdx: sql`CREATE INDEX IF NOT EXISTS kanban_leads_company_contact_idx ON ${table} (company_id, contact_id)`,
  companyUpdatedAtIdx: sql`CREATE INDEX IF NOT EXISTS kanban_leads_company_updated_at_idx ON ${table} (company_id, updated_at DESC)`,
  externalIdProviderUnique: unique('kanban_leads_external_id_provider_unique').on(table.externalId, table.externalProvider),
}));

export const kanbanStagePersonas = pgTable('kanban_stage_personas', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  boardId: text('board_id').notNull().references(() => kanbanBoards.id, { onDelete: 'cascade' }),
  stageId: text('stage_id'),
  activePersonaId: text('active_persona_id').references(() => aiPersonas.id, { onDelete: 'set null' }),
  passivePersonaId: text('passive_persona_id').references(() => aiPersonas.id, { onDelete: 'set null' }),
  activeDisabled: boolean('active_disabled').default(false).notNull(),
  passiveDisabled: boolean('passive_disabled').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  boardStageUnique: unique('kanban_stage_personas_board_stage_unique').on(table.boardId, table.stageId),
}));

// ==============================
// CAMPANHAS, MODELOS & SMS
// ==============================

export const mediaAssets = pgTable('media_assets', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type'),
  s3Url: text('s3_url').notNull(),
  s3Key: text('s3_key').notNull(),
  metaHandles: jsonb('meta_handles').$type<MetaHandle[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  companyTypeIdx: sql`CREATE INDEX IF NOT EXISTS media_assets_company_type_idx ON ${table} (company_id, type)`,
  companyCreatedAtIdx: sql`CREATE INDEX IF NOT EXISTS media_assets_company_created_at_idx ON ${table} (company_id, created_at DESC)`,
}));

export const templates = pgTable('templates', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  wabaId: text('waba_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  body: text('body').notNull(),
  headerType: text('header_type').default('NONE'),
  language: text('language').notNull(),
  status: text('status').notNull(),
  metaId: text('meta_id').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS templates_company_status_idx ON ${table} (company_id, status)`,
  companyCategoryIdx: sql`CREATE INDEX IF NOT EXISTS templates_company_category_idx ON ${table} (company_id, category)`,
  companyWabaIdx: sql`CREATE INDEX IF NOT EXISTS templates_company_waba_idx ON ${table} (company_id, waba_id)`,
}));

export const messageTemplates = pgTable('message_templates', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),

  name: varchar('name', { length: 512 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  metaTemplateId: varchar('meta_template_id', { length: 255 }),
  wabaId: varchar('waba_id', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  language: varchar('language', { length: 10 }).notNull().default('pt_BR'),
  parameterFormat: varchar('parameter_format', { length: 20 }).default('POSITIONAL'),
  status: varchar('status', { length: 50 }).notNull().default('DRAFT'),
  rejectedReason: text('rejected_reason'),
  components: jsonb('components').notNull(),
  messageSendTtlSeconds: integer('message_send_ttl_seconds'),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
  submittedAt: timestamp('submitted_at'),
  approvedAt: timestamp('approved_at'),
  sentCount: integer('sent_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').default(true),
  allowCategoryChange: boolean('allow_category_change').default(true),
}, (table) => ({
  uniqueNameWaba: unique('message_templates_name_waba_unique').on(table.name, table.wabaId),
}));

export const smsGateways = pgTable('sms_gateways', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  name: text('name').notNull(),
  credentials: jsonb('credentials').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const campaigns = pgTable('campaigns', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  channel: text('channel').notNull().default('WHATSAPP'),
  status: text('status').notNull(),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  completedAt: timestamp('completed_at'),
  connectionId: text('connection_id').references(() => connections.id, { onDelete: 'set null' }),
  templateId: text('template_id').references(() => messageTemplates.id, { onDelete: 'set null' }),
  variableMappings: jsonb('variable_mappings'),
  mediaAssetId: text('media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
  smsGatewayId: text('sms_gateway_id').references(() => smsGateways.id),
  smsProviderMailingId: text('sms_provider_mailing_id'),
  smsNextContactIndex: integer('sms_next_contact_index').default(0),
  voiceAgentId: text('voice_agent_id'),
  message: text('message'),
  contactListIds: text('contact_list_ids').array(),
  excludeListIds: text('exclude_list_ids').array(),
  tagIds: text('tag_ids').array(),
  excludeTagIds: text('exclude_tag_ids').array(),
  funnelIds: text('funnel_ids').array(),
  funnelStageIds: text('funnel_stage_ids').array(),
  retryContactIds: text('retry_contact_ids').array(),
  parentCampaignId: text('parent_campaign_id'),
  batchSize: integer('batch_size'),
  batchDelaySeconds: integer('batch_delay_seconds'),
  enableRetry: boolean('enable_retry').default(false),
  maxRetryAttempts: integer('max_retry_attempts').default(3),
  retryDelayMinutes: integer('retry_delay_minutes').default(30),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS campaigns_company_status_idx ON ${table} (company_id, status)`,
  companyCreatedAtIdx: sql`CREATE INDEX IF NOT EXISTS campaigns_company_created_at_idx ON ${table} (company_id, created_at DESC)`,
  companyChannelStatusIdx: sql`CREATE INDEX IF NOT EXISTS campaigns_company_channel_status_idx ON ${table} (company_id, channel, status)`,
}));

export const whatsappDeliveryReports = pgTable('whatsapp_delivery_reports', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').references(() => connections.id, { onDelete: 'set null' }),
  providerMessageId: text('provider_message_id'),
  status: text('status').notNull(),
  failureReason: text('failure_reason'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const smsDeliveryReports = pgTable('sms_delivery_reports', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  smsGatewayId: text('sms_gateway_id').notNull().references(() => smsGateways.id),
  providerMessageId: text('provider_message_id'),
  status: text('status').notNull(),
  failureReason: text('failure_reason'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const smsDeliveryLogs = pgTable('sms_delivery_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar('campaign_id').notNull(),
  contactId: varchar('contact_id').notNull(),
  smsGatewayId: varchar('sms_gateway_id').notNull(),
  status: varchar('status').notNull(),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const voiceCallOutcomeEnum = pgEnum('voice_call_outcome', [
  'human',
  'voicemail',
  'no_answer',
  'busy',
  'failed',
  'pending'
]);

export const voiceDeliveryReports = pgTable('voice_delivery_reports', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  voiceAgentId: text('voice_agent_id'),
  providerCallId: text('provider_call_id'),
  status: text('status').notNull(),
  callOutcome: voiceCallOutcomeEnum('call_outcome').default('pending'),
  attemptNumber: integer('attempt_number').default(1).notNull(),
  nextRetryAt: timestamp('next_retry_at'),
  failureReason: text('failure_reason'),
  duration: integer('duration'),
  disconnectionReason: text('disconnection_reason'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const voiceRetryStatusEnum = pgEnum('voice_retry_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
]);

export const voiceRetryQueue = pgTable('voice_retry_queue', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  voiceAgentId: text('voice_agent_id').notNull(),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  status: voiceRetryStatusEnum('status').default('pending').notNull(),
  lastAttemptReason: text('last_attempt_reason'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  campaignContactUnique: unique('voice_retry_queue_campaign_contact_attempt').on(table.campaignId, table.contactId, table.attemptNumber),
}));

// ==============================
// CRM INTEGRATIONS
// ==============================

export const crmIntegrations = pgTable('crm_integrations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  status: text('status').notNull().default('disconnected'),
  config: jsonb('config').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const crmAccounts = pgTable('crm_accounts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  integrationId: text('integration_id').notNull().references(() => crmIntegrations.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull(),
  authType: text('auth_type').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
});

export const crmMappings = pgTable('crm_mappings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  integrationId: text('integration_id').notNull().references(() => crmIntegrations.id, { onDelete: 'cascade' }),
  boardId: text('board_id').notNull().references(() => kanbanBoards.id, { onDelete: 'cascade' }),
  pipelineId: text('pipeline_id').notNull(),
  stageMap: jsonb('stage_map').notNull(),
}, (table) => ({
  boardIdUnique: unique('crm_mappings_board_id_unique').on(table.boardId),
}));

export const crmSyncLogs = pgTable('crm_sync_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  integrationId: text('integration_id').notNull().references(() => crmIntegrations.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  payload: jsonb('payload'),
  status: text('status').notNull(),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// AI Chat Tables
export const aiChats = pgTable('ai_chats', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  title: text('title'),
  personaId: text('persona_id').references(() => aiPersonas.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const aiChatMessages = pgTable('ai_chat_messages', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  chatId: text('chat_id').notNull().references(() => aiChats.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  tokensIn: integer('tokens_in').default(0),
  tokensOut: integer('tokens_out').default(0),
  cost: decimal('cost', { precision: 10, scale: 6 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiUsageDaily = pgTable('ai_usage_daily', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  tokensIn: integer('tokens_in').default(0).notNull(),
  tokensOut: integer('tokens_out').default(0).notNull(),
  cost: decimal('cost', { precision: 10, scale: 6 }).default('0').notNull(),
  requestCount: integer('request_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyDateProviderModelUnique: unique('ai_usage_daily_company_date_provider_model_unique').on(
    table.companyId,
    table.date,
    table.provider,
    table.model
  ),
}));

export const aiAgentExecutions = pgTable('ai_agent_executions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  agentName: text('agent_name'),
  toolName: text('tool_name'),
  request: text('request'),
  response: text('response'),
  status: text('status').notNull().default('completed'),
  executionTime: integer('execution_time'), // in milliseconds
  tokensUsed: integer('tokens_used').default(0),
  cost: decimal('cost', { precision: 10, scale: 6 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==============================
// AI FOLLOW-UP QUEUE
// ==============================

export const aiFollowupQueue = pgTable('ai_followup_queue', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  personaId: text('persona_id').notNull().references(() => aiPersonas.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp('scheduled_at').notNull(),
  attemptNumber: integer('attempt_number').default(1).notNull(),
  status: text('status').default('pending').notNull(), // pending, sent, cancelled
  sentAt: timestamp('sent_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pendingIdx: sql`CREATE INDEX IF NOT EXISTS idx_followup_queue_pending ON ${table} (status, scheduled_at) WHERE status = 'pending'`,
  conversationIdx: sql`CREATE INDEX IF NOT EXISTS idx_followup_queue_conversation ON ${table} (conversation_id, status)`,
}));


// ==============================
// SECURITY LOGS
// ==============================

export const securityLogs = pgTable('security_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  threatType: text('threat_type').notNull(),
  threatLevel: text('threat_level').notNull(),
  content: text('content'),
  actionTaken: text('action_taken').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


// ==============================
// VOICE AI PLATFORM (plataformai.global)
// ==============================

export const voiceAgents = pgTable('voice_agents', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  externalId: text('external_id'),
  name: varchar('name', { length: 255 }).notNull(),
  type: text('type').notNull().default('inbound'),
  status: text('status').notNull().default('active'),
  systemPrompt: text('system_prompt').notNull(),
  firstMessage: text('first_message'),
  voiceId: varchar('voice_id', { length: 100 }).default('pt-BR-FranciscaNeural'),
  llmProvider: varchar('llm_provider', { length: 50 }).default('openai'),
  llmModel: varchar('llm_model', { length: 50 }).default('gpt-4'),
  temperature: decimal('temperature', { precision: 3, scale: 2 }).default('0.7'),
  maxTokens: integer('max_tokens').default(500),
  interruptSensitivity: decimal('interrupt_sensitivity', { precision: 3, scale: 2 }).default('0.5'),
  responseDelay: integer('response_delay').default(100),
  retellAgentId: text('retell_agent_id'),
  config: jsonb('config'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
  archivedAt: timestamp('archived_at'),
});

// bytea type for binary data in Postgres/Neon
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Buffer) {
    return value;
  },
  fromDriver(value: unknown) {
    if (Buffer.isBuffer(value)) return value;
    return Buffer.from(value as any);
  }
});

export const storageFiles = pgTable('storage_files', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  key: text('key').notNull().unique(), // e.g. "tenants/uuid/media_recebida/uuid.jpg"
  mimeType: text('mime_type').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const voiceCalls = pgTable('voice_calls', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').references(() => voiceAgents.id, { onDelete: 'set null' }),
  contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  externalCallId: text('external_call_id'),
  retellCallId: text('retell_call_id'),
  twilioCallSid: text('twilio_call_sid'),
  direction: text('direction').notNull().default('outbound'),
  fromNumber: varchar('from_number', { length: 20 }),
  toNumber: varchar('to_number', { length: 20 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }),
  status: text('status').notNull().default('initiated'),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  duration: integer('duration'),
  transcript: jsonb('transcript'),
  recordingUrl: text('recording_url'),
  summary: text('summary'),
  qualityScore: decimal('quality_score', { precision: 5, scale: 2 }),
  sentimentScore: decimal('sentiment_score', { precision: 4, scale: 3 }),
  latencyMs: integer('latency_ms'),
  interruptionsCount: integer('interruptions_count'),
  cost: decimal('cost', { precision: 10, scale: 4 }),
  resolved: boolean('resolved'),
  disconnectReason: text('disconnect_reason'),
  provider: text('provider').notNull().default('voice-ai-platform'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ===================================
// RELAÇÕES (DRIZZLE ORM)
// ===================================
export const conversationsRelations = relations(conversations, ({ one }) => ({
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  connection: one(connections, {
    fields: [conversations.connectionId],
    references: [connections.id]
  })
}));



export const voiceAgentsRelations = relations(voiceAgents, ({ one, many }) => ({
  company: one(companies, {
    fields: [voiceAgents.companyId],
    references: [companies.id],
  }),
  calls: many(voiceCalls),
}));

export const voiceCallsRelations = relations(voiceCalls, ({ one }) => ({
  company: one(companies, {
    fields: [voiceCalls.companyId],
    references: [companies.id],
  }),
  agent: one(voiceAgents, {
    fields: [voiceCalls.agentId],
    references: [voiceAgents.id],
  }),
  contact: one(contacts, {
    fields: [voiceCalls.contactId],
    references: [contacts.id],
  }),
  conversation: one(conversations, {
    fields: [voiceCalls.conversationId],
    references: [conversations.id],
  }),
}));

// ==============================
// NOTIFICATION AGENTS & LOGS
// ==============================

export const notificationAgents = pgTable('notification_agents', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  enabledNotifications: jsonb('enabled_notifications').$type<{
    dailyReport: boolean;
    weeklyReport: boolean;
    biweeklyReport: boolean;
    monthlyReport: boolean;
    biannualReport: boolean;
    newMeeting: boolean;
    newSale: boolean;
    campaignSent: boolean;
  }>().notNull().default(sql`'{"dailyReport":false,"weeklyReport":false,"biweeklyReport":false,"monthlyReport":false,"biannualReport":false,"newMeeting":false,"newSale":false,"campaignSent":false}'::jsonb`),
  scheduleTime: varchar('schedule_time', { length: 5 }).default('09:00'),
  timezone: varchar('timezone', { length: 50 }).default('America/Sao_Paulo'),
  lastSentAt: jsonb('last_sent_at').$type<Record<string, string>>(),
  rateLimitWindow: integer('rate_limit_window').default(60),
  rateLimitCount: integer('rate_limit_count').default(10),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  uniqueCompanyName: unique('notification_agents_company_name_unique').on(table.companyId, table.name),
  companyActiveIdx: sql`CREATE INDEX IF NOT EXISTS notification_agents_company_active_idx ON ${table} (company_id, is_active) WHERE is_active = true`,
}));

export const notificationAgentGroups = pgTable('notification_agent_groups', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull().references(() => notificationAgents.id, { onDelete: 'cascade' }),
  groupJid: varchar('group_jid', { length: 255 }).notNull(),
  groupName: varchar('group_name', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueAgentGroup: unique('notification_agent_groups_unique').on(table.agentId, table.groupJid),
}));

export const notificationLogs = pgTable('notification_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull().references(() => notificationAgents.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  groupJid: varchar('group_jid', { length: 255 }).notNull(),
  message: text('message').notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  metadata: jsonb('metadata'),
  retryCount: integer('retry_count').default(0).notNull(),
  errorCode: varchar('error_code', { length: 50 }),
  failureReason: text('failure_reason'),
  traceId: text('trace_id').default(sql`gen_random_uuid()`),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
}, (table) => ({
  agentStatusIdx: sql`CREATE INDEX IF NOT EXISTS notification_logs_agent_status_idx ON ${table} (agent_id, status, sent_at DESC)`,
  typeIdx: sql`CREATE INDEX IF NOT EXISTS notification_logs_type_idx ON ${table} (type, sent_at DESC)`,
}));

export const aiPersonasRelations = relations(aiPersonas, ({ many }) => ({
  promptSections: many(personaPromptSections),
}));

export const personaPromptSectionsRelations = relations(personaPromptSections, ({ one }) => ({
  persona: one(aiPersonas, {
    fields: [personaPromptSections.personaId],
    references: [aiPersonas.id],
  }),
}));

export const kanbanBoardsRelations = relations(kanbanBoards, ({ one, many }) => ({
  company: one(companies, {
    fields: [kanbanBoards.companyId],
    references: [companies.id],
  }),
  leads: many(kanbanLeads),
  stagePersonas: many(kanbanStagePersonas),
}));

export const kanbanLeadsRelations = relations(kanbanLeads, ({ one }) => ({
  board: one(kanbanBoards, {
    fields: [kanbanLeads.boardId],
    references: [kanbanBoards.id],
  }),
  contact: one(contacts, {
    fields: [kanbanLeads.contactId],
    references: [contacts.id],
  }),
}));

export const kanbanStagePersonasRelations = relations(kanbanStagePersonas, ({ one }) => ({
  board: one(kanbanBoards, {
    fields: [kanbanStagePersonas.boardId],
    references: [kanbanBoards.id],
  }),
  activePersona: one(aiPersonas, {
    fields: [kanbanStagePersonas.activePersonaId],
    references: [aiPersonas.id],
  }),
  passivePersona: one(aiPersonas, {
    fields: [kanbanStagePersonas.passivePersonaId],
    references: [aiPersonas.id],
  }),
}));

export const notificationAgentsRelations = relations(notificationAgents, ({ one, many }) => ({
  company: one(companies, {
    fields: [notificationAgents.companyId],
    references: [companies.id],
  }),
  connection: one(connections, {
    fields: [notificationAgents.connectionId],
    references: [connections.id],
  }),
  groups: many(notificationAgentGroups),
  logs: many(notificationLogs),
}));

export const notificationAgentGroupsRelations = relations(notificationAgentGroups, ({ one }) => ({
  agent: one(notificationAgents, {
    fields: [notificationAgentGroups.agentId],
    references: [notificationAgents.id],
  }),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  agent: one(notificationAgents, {
    fields: [notificationLogs.agentId],
    references: [notificationAgents.id],
  }),
}));

export const webhookEventTypeEnum = pgEnum('webhook_event_type', [
  'conversation_created',
  'conversation_updated',
  'message_received',
  'message_sent',
  'lead_created',
  'lead_stage_changed',
  'sale_closed',
  'meeting_scheduled',
  'campaign_sent',
  'campaign_completed',
]);

export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: webhookEventTypeEnum('events').array().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: text('subscription_id').notNull().references(() => webhookSubscriptions.id, { onDelete: 'cascade' }),
  eventType: webhookEventTypeEnum('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at'),
  nextRetryAt: timestamp('next_retry_at'),
  response: jsonb('response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customTemplateCategories = pgTable('custom_template_categories', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const customMessageTemplates = pgTable('custom_message_templates', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => customTemplateCategories.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  content: text('content').notNull(),
  variables: text('variables').array().notNull().default(sql`'{}'::text[]`),
  isPredefined: boolean('is_predefined').notNull().default(false),
  active: boolean('active').notNull().default(true),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ==============================
// USER NOTIFICATIONS (IN-APP)
// ==============================

export const userNotificationTypeEnum = pgEnum('user_notification_type', [
  'campaign_completed',
  'new_conversation',
  'new_appointment',
  'system_error',
  'info',
]);

export const userNotifications = pgTable('user_notifications', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull(), // Removed cascade constraint to allow notifications from various sources
  type: userNotificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  linkTo: text('link_to'),
  metadata: jsonb('metadata').$type<{
    campaignId?: string;
    conversationId?: string;
    contactId?: string;
    errorId?: string;
    [key: string]: any;
  }>(),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userReadIdx: sql`CREATE INDEX IF NOT EXISTS user_notifications_user_read_idx ON ${table} (user_id, is_read, created_at DESC)`,
  companyIdx: sql`CREATE INDEX IF NOT EXISTS user_notifications_company_idx ON ${table} (company_id, created_at DESC)`,
}));

// ==============================
// ERROR MONITORING SYSTEM
// ==============================

export const errorSourceEnum = pgEnum('error_source', ['frontend', 'backend', 'database', 'api', 'webhook']);
export const errorSeverityEnum = pgEnum('error_severity', ['low', 'medium', 'high', 'critical']);
export const errorStatusEnum = pgEnum('error_status', ['new', 'investigating', 'resolved', 'ignored']);

export const systemErrors = pgTable('system_errors', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  source: errorSourceEnum('source').notNull(),
  severity: errorSeverityEnum('severity').notNull().default('medium'),
  status: errorStatusEnum('status').notNull().default('new'),
  errorType: varchar('error_type', { length: 255 }),
  message: text('message').notNull(),
  stack: text('stack'),
  context: jsonb('context').$type<{
    url?: string;
    userAgent?: string;
    component?: string;
    apiEndpoint?: string;
    requestBody?: any;
    responseStatus?: number;
    [key: string]: any;
  }>(),
  aiDiagnosis: text('ai_diagnosis'),
  aiRecommendation: text('ai_recommendation'),
  aiAnalyzedAt: timestamp('ai_analyzed_at'),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  lastOccurredAt: timestamp('last_occurred_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceStatusIdx: sql`CREATE INDEX IF NOT EXISTS system_errors_source_status_idx ON ${table} (source, status, created_at DESC)`,
  severityIdx: sql`CREATE INDEX IF NOT EXISTS system_errors_severity_idx ON ${table} (severity, created_at DESC)`,
  companyIdx: sql`CREATE INDEX IF NOT EXISTS system_errors_company_idx ON ${table} (company_id, created_at DESC) WHERE company_id IS NOT NULL`,
}));

export const webhookSubscriptionsRelations = relations(webhookSubscriptions, ({ one, many }) => ({
  company: one(companies, {
    fields: [webhookSubscriptions.companyId],
    references: [companies.id],
  }),
  events: many(webhookEvents),
}));

export const webhookEventsRelations = relations(webhookEvents, ({ one }) => ({
  subscription: one(webhookSubscriptions, {
    fields: [webhookEvents.subscriptionId],
    references: [webhookSubscriptions.id],
  }),
}));

export const customTemplateCategoriesRelations = relations(customTemplateCategories, ({ one, many }) => ({
  company: one(companies, {
    fields: [customTemplateCategories.companyId],
    references: [companies.id],
  }),
  templates: many(customMessageTemplates),
}));

export const customMessageTemplatesRelations = relations(customMessageTemplates, ({ one }) => ({
  company: one(companies, {
    fields: [customMessageTemplates.companyId],
    references: [companies.id],
  }),
  category: one(customTemplateCategories, {
    fields: [customMessageTemplates.categoryId],
    references: [customTemplateCategories.id],
  }),
}));

// ==============================
// CADENCE SYSTEM (DRIP CAMPAIGNS)
// ==============================

export const cadenceDefinitions = pgTable('cadence_definitions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  funnelId: text('funnel_id').references(() => kanbanBoards.id, { onDelete: 'set null' }),
  stageId: text('stage_id'),
  triggerAfterDays: integer('trigger_after_days').notNull().default(21),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyActiveIdx: sql`CREATE INDEX IF NOT EXISTS cadence_definitions_company_active_idx ON ${table} (company_id, is_active) WHERE is_active = true`,
}));

export const cadenceSteps = pgTable('cadence_steps', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  cadenceId: text('cadence_id').notNull().references(() => cadenceDefinitions.id, { onDelete: 'cascade' }),
  stepOrder: integer('step_order').notNull(),
  offsetDays: integer('offset_days').notNull().default(0),
  channel: text('channel').notNull().default('whatsapp'),
  templateId: text('template_id').references(() => messageTemplates.id, { onDelete: 'set null' }),
  messageContent: text('message_content'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  cadenceOrderUnique: unique('cadence_steps_cadence_order_unique').on(table.cadenceId, table.stepOrder),
}));

export const cadenceEnrollmentStatusEnum = pgEnum('cadence_enrollment_status', ['active', 'completed', 'cancelled']);

export const cadenceEnrollments = pgTable('cadence_enrollments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  cadenceId: text('cadence_id').notNull().references(() => cadenceDefinitions.id, { onDelete: 'cascade' }),
  leadId: text('lead_id').references(() => kanbanLeads.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  status: cadenceEnrollmentStatusEnum('status').notNull().default('active'),
  currentStep: integer('current_step').notNull().default(0),
  nextRunAt: timestamp('next_run_at'),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  cancelledReason: text('cancelled_reason'),
}, (table) => ({
  schedulingIdx: sql`CREATE INDEX IF NOT EXISTS cadence_enrollments_scheduling_idx ON ${table} (status, next_run_at) WHERE status = 'active'`,
  leadActiveUnique: unique('cadence_enrollments_lead_active_unique').on(table.leadId, table.cadenceId),
}));

export const cadenceEventTypeEnum = pgEnum('cadence_event_type', ['enrolled', 'step_sent', 'replied', 'completed', 'cancelled']);

export const cadenceEvents = pgTable('cadence_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  enrollmentId: text('enrollment_id').notNull().references(() => cadenceEnrollments.id, { onDelete: 'cascade' }),
  stepId: text('step_id').references(() => cadenceSteps.id, { onDelete: 'set null' }),
  eventType: cadenceEventTypeEnum('event_type').notNull(),
  messageId: text('message_id').references(() => messages.id, { onDelete: 'set null' }),
  metadata: jsonb('event_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  enrollmentTypeIdx: sql`CREATE INDEX IF NOT EXISTS cadence_events_enrollment_type_idx ON ${table} (enrollment_id, event_type, created_at DESC)`,
}));

export const cadenceDefinitionsRelations = relations(cadenceDefinitions, ({ one, many }) => ({
  company: one(companies, {
    fields: [cadenceDefinitions.companyId],
    references: [companies.id],
  }),
  funnel: one(kanbanBoards, {
    fields: [cadenceDefinitions.funnelId],
    references: [kanbanBoards.id],
  }),
  steps: many(cadenceSteps),
  enrollments: many(cadenceEnrollments),
}));

export const cadenceStepsRelations = relations(cadenceSteps, ({ one, many }) => ({
  cadence: one(cadenceDefinitions, {
    fields: [cadenceSteps.cadenceId],
    references: [cadenceDefinitions.id],
  }),
  template: one(messageTemplates, {
    fields: [cadenceSteps.templateId],
    references: [messageTemplates.id],
  }),
  events: many(cadenceEvents),
}));

export const cadenceEnrollmentsRelations = relations(cadenceEnrollments, ({ one, many }) => ({
  cadence: one(cadenceDefinitions, {
    fields: [cadenceEnrollments.cadenceId],
    references: [cadenceDefinitions.id],
  }),
  lead: one(kanbanLeads, {
    fields: [cadenceEnrollments.leadId],
    references: [kanbanLeads.id],
  }),
  contact: one(contacts, {
    fields: [cadenceEnrollments.contactId],
    references: [contacts.id],
  }),
  conversation: one(conversations, {
    fields: [cadenceEnrollments.conversationId],
    references: [conversations.id],
  }),
  events: many(cadenceEvents),
}));

// ==============================
// ALERT SYSTEM TABLES
// ==============================

export const alertSeverityEnum = pgEnum('alert_severity', [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]);

export const alertStatusEnum = pgEnum('alert_status', [
  'active',
  'acknowledged',
  'resolved',
  'suppressed',
  'expired',
]);

export const alertChannelEnum = pgEnum('alert_channel', [
  'console',
  'database',
  'webhook',
  'in_app',
  'email',
]);

export const alertTypeEnum = pgEnum('alert_type', [
  'high_memory_usage',
  'cache_failure',
  'database_pool_exhausted',
  'rate_limit_breach',
  'queue_failure',
  'auth_failures_spike',
  'response_time_degradation',
  'custom',
]);

export const alerts = pgTable('alerts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  alertType: alertTypeEnum('alert_type').notNull(),
  severity: alertSeverityEnum('severity').notNull(),
  status: alertStatusEnum('status').notNull().default('active'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  metric: varchar('metric', { length: 255 }),
  threshold: decimal('threshold', { precision: 10, scale: 2 }),
  currentValue: decimal('current_value', { precision: 10, scale: 2 }),
  context: jsonb('context').$type<Record<string, any>>(),
  fingerprint: varchar('fingerprint', { length: 255 }).notNull(), // For deduplication
  occurrenceCount: integer('occurrence_count').default(1).notNull(),
  firstOccurredAt: timestamp('first_occurred_at').defaultNow().notNull(),
  lastOccurredAt: timestamp('last_occurred_at').defaultNow().notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedBy: text('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  fingerprintIdx: sql`CREATE INDEX IF NOT EXISTS alerts_fingerprint_idx ON ${table} (fingerprint)`,
  statusIdx: sql`CREATE INDEX IF NOT EXISTS alerts_status_idx ON ${table} (status)`,
  severityIdx: sql`CREATE INDEX IF NOT EXISTS alerts_severity_idx ON ${table} (severity)`,
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS alerts_company_status_idx ON ${table} (company_id, status) WHERE status = 'active'`,
}));

export const alertRules = pgTable('alert_rules', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  alertType: alertTypeEnum('alert_type').notNull(),
  severity: alertSeverityEnum('severity').notNull(),
  metric: varchar('metric', { length: 255 }).notNull(),
  condition: varchar('condition', { length: 50 }).notNull(), // 'gt', 'lt', 'eq', 'gte', 'lte'
  threshold: decimal('threshold', { precision: 10, scale: 2 }).notNull(),
  windowSeconds: integer('window_seconds').default(300).notNull(), // 5 minutes default
  aggregation: varchar('aggregation', { length: 50 }).default('avg'), // 'avg', 'max', 'min', 'sum', 'count'
  channels: alertChannelEnum('channels').array().notNull(),
  webhookUrls: text('webhook_urls').array(),
  cooldownSeconds: integer('cooldown_seconds').default(3600).notNull(), // 1 hour default
  isEnabled: boolean('is_enabled').default(true).notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  nameCompanyUnique: unique('alert_rules_name_company_unique').on(table.name, table.companyId),
  enabledIdx: sql`CREATE INDEX IF NOT EXISTS alert_rules_enabled_idx ON ${table} (is_enabled) WHERE is_enabled = true`,
}));

export const alertNotifications = pgTable('alert_notifications', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  alertId: text('alert_id').notNull().references(() => alerts.id, { onDelete: 'cascade' }),
  ruleId: text('rule_id').references(() => alertRules.id, { onDelete: 'set null' }),
  channel: alertChannelEnum('channel').notNull(),
  recipient: text('recipient'), // email, webhook URL, user ID, etc.
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'sent', 'failed'
  attemptCount: integer('attempt_count').default(0).notNull(),
  sentAt: timestamp('sent_at'),
  failureReason: text('failure_reason'),
  response: jsonb('response').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  alertChannelIdx: sql`CREATE INDEX IF NOT EXISTS alert_notifications_alert_channel_idx ON ${table} (alert_id, channel)`,
  statusIdx: sql`CREATE INDEX IF NOT EXISTS alert_notifications_status_idx ON ${table} (status)`,
}));

export const alertSettings = pgTable('alert_settings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }).unique(),
  memoryThreshold: decimal('memory_threshold', { precision: 5, scale: 2 }).default('90.00'), // percentage
  responseTimeP95Threshold: integer('response_time_p95_threshold').default(1000), // milliseconds
  rateLimit429Threshold: integer('rate_limit_429_threshold').default(100), // per minute
  authFailureThreshold: integer('auth_failure_threshold').default(10), // per 5 minutes
  queueFailureThreshold: integer('queue_failure_threshold').default(5), // per minute
  dbPoolThreshold: decimal('db_pool_threshold', { precision: 5, scale: 2 }).default('90.00'), // percentage
  alertRetentionDays: integer('alert_retention_days').default(30),
  enabledChannels: alertChannelEnum('enabled_channels').array().default(sql`'{database,console}'::alert_channel[]`),
  defaultWebhookUrl: text('default_webhook_url'),
  emailRecipients: text('email_recipients').array(),
  suppressionRules: jsonb('suppression_rules').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// Relations for alerts
export const alertsRelations = relations(alerts, ({ one, many }) => ({
  company: one(companies, {
    fields: [alerts.companyId],
    references: [companies.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [alerts.acknowledgedBy],
    references: [users.id],
    relationName: 'acknowledgedAlerts',
  }),
  resolvedByUser: one(users, {
    fields: [alerts.resolvedBy],
    references: [users.id],
    relationName: 'resolvedAlerts',
  }),
  notifications: many(alertNotifications),
}));

export const alertRulesRelations = relations(alertRules, ({ one }) => ({
  company: one(companies, {
    fields: [alertRules.companyId],
    references: [companies.id],
  }),
}));

export const alertNotificationsRelations = relations(alertNotifications, ({ one }) => ({
  alert: one(alerts, {
    fields: [alertNotifications.alertId],
    references: [alerts.id],
  }),
  rule: one(alertRules, {
    fields: [alertNotifications.ruleId],
    references: [alertRules.id],
  }),
}));

export const alertSettingsRelations = relations(alertSettings, ({ one }) => ({
  company: one(companies, {
    fields: [alertSettings.companyId],
    references: [companies.id],
  }),
}));

export const cadenceEventsRelations = relations(cadenceEvents, ({ one }) => ({
  enrollment: one(cadenceEnrollments, {
    fields: [cadenceEvents.enrollmentId],
    references: [cadenceEnrollments.id],
  }),
  step: one(cadenceSteps, {
    fields: [cadenceEvents.stepId],
    references: [cadenceSteps.id],
  }),
  message: one(messages, {
    fields: [cadenceEvents.messageId],
    references: [messages.id],
  }),
}));

// ==============================
// EMAIL EVENTS (RESEND WEBHOOKS)
// ==============================

export const emailEventTypeEnum = pgEnum('email_event_type', [
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'delivery_delayed'
]);

export const emailEvents = pgTable('email_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  emailId: text('email_id').notNull(), // ID retornado pelo Resend
  eventType: emailEventTypeEnum('event_type').notNull(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  subject: text('subject'),
  metadata: jsonb('metadata'),
  companyId: text('company_id').references(() => companies.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  company: one(companies, {
    fields: [emailEvents.companyId],
    references: [companies.id],
  }),
}));

// ==============================
// ADMIN DASHBOARD: FEATURES & PERMISSIONS
// ==============================

export const featureEnum = pgEnum('feature_type', [
  'CRM_BASIC',
  'CRM_ADVANCED',
  'WHATSAPP_API',
  'WHATSAPP_BAILEYS',
  'SMS',
  'VOICE_AI',
  'EMAIL_SENDING',
  'EMAIL_TRACKING',
  'AI_AUTOMATION',
  'CAMPAIGNS',
  'ANALYTICS',
]);

export const features = pgTable('features', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  key: featureEnum('key').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companyFeatureAccess = pgTable('company_feature_access', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  featureId: text('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').default(true).notNull(),
  accessLevel: varchar('access_level', { length: 50 }).default('full').notNull(), // 'full', 'limited', 'readonly'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  companyFeatureUnique: unique('company_feature_access_unique').on(table.companyId, table.featureId),
}));

export const userPermissions = pgTable('user_permissions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  featureId: text('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
  permissionLevel: varchar('permission_level', { length: 50 }).default('use').notNull(), // 'use', 'manage', 'admin'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userFeatureUnique: unique('user_permissions_unique').on(table.userId, table.featureId),
}));

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(), // create_user, delete_user, update_feature, etc
  resource: varchar('resource', { length: 100 }).notNull(), // users, companies, features, permissions
  resourceId: text('resource_id'),
  metadata: jsonb('metadata'), // extra info about the action
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==============================
// META WEBHOOK HEALTH EVENTS
// ==============================

export const webhookHealthStatusEnum = pgEnum('webhook_health_status', ['success', 'failure']);

export const metaWebhookHealthEvents = pgTable('meta_webhook_health_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  connectionId: text('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  status: webhookHealthStatusEnum('status').notNull(),
  validatedAt: timestamp('validated_at').defaultNow().notNull(),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
});

export const metaWebhookHealthEventsRelations = relations(metaWebhookHealthEvents, ({ one }) => ({
  connection: one(connections, {
    fields: [metaWebhookHealthEvents.connectionId],
    references: [connections.id],
  }),
}));

// ==============================
// RELATIONS: FEATURES & PERMISSIONS
// ==============================

export const featuresRelations = relations(features, ({ many }) => ({
  companyFeatureAccess: many(companyFeatureAccess),
  userPermissions: many(userPermissions),
}));

export const companyFeatureAccessRelations = relations(companyFeatureAccess, ({ one }) => ({
  company: one(companies, {
    fields: [companyFeatureAccess.companyId],
    references: [companies.id],
  }),
  feature: one(features, {
    fields: [companyFeatureAccess.featureId],
    references: [features.id],
  }),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userPermissions.userId],
    references: [users.id],
  }),
  feature: one(features, {
    fields: [userPermissions.featureId],
    references: [features.id],
  }),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  user: one(users, {
    fields: [adminAuditLogs.userId],
    references: [users.id],
  }),
}));

// ==============================
// GOOGLE CALENDAR INTEGRATION
// ==============================

export const googleCalendarCredentials = pgTable('google_calendar_credentials', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenExpiry: timestamp('token_expiry'),
  calendarId: text('calendar_id'), // Calendário principal (backward compat)
  calendarName: text('calendar_name'), // Nome do calendário principal (backward compat)
  activeCalendars: jsonb('active_calendars').$type<Array<{
    id: string;
    name: string;
    priority: number; // 1 = principal, 2 = fallback 1, etc.
    isActive: boolean;
  }>>().default([]),
  schedulingMode: text('scheduling_mode').default('fill_first').notNull(), // 'fill_first' | 'round_robin'
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const meetingStatusEnum = pgEnum('meeting_status', ['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show']);

export const aiScheduledMeetings = pgTable('ai_scheduled_meetings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  kanbanLeadId: text('kanban_lead_id'), // Link to kanban lead for tracking
  googleEventId: text('google_event_id'),
  calendarId: text('calendar_id'), // Qual calendário foi usado
  calendarName: text('calendar_name_used'), // Nome do calendário usado
  title: text('title').notNull(),
  description: text('description'),
  scheduledAt: timestamp('scheduled_at').notNull(),
  durationMinutes: integer('duration_minutes').default(30).notNull(),
  attendeeEmail: text('attendee_email'),
  attendeeName: text('attendee_name'),
  meetLink: text('meet_link'), // Link do Google Meet se gerado
  status: meetingStatusEnum('status').default('scheduled').notNull(),
  reminderSent: boolean('reminder_sent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// Relations for Google Calendar
export const googleCalendarCredentialsRelations = relations(googleCalendarCredentials, ({ one }) => ({
  company: one(companies, {
    fields: [googleCalendarCredentials.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [googleCalendarCredentials.userId],
    references: [users.id],
  }),
}));

export const aiScheduledMeetingsRelations = relations(aiScheduledMeetings, ({ one }) => ({
  company: one(companies, {
    fields: [aiScheduledMeetings.companyId],
    references: [companies.id],
  }),
  conversation: one(conversations, {
    fields: [aiScheduledMeetings.conversationId],
    references: [conversations.id],
  }),
  contact: one(contacts, {
    fields: [aiScheduledMeetings.contactId],
    references: [contacts.id],
  }),
}));

// ==============================
// GOOGLE DRIVE INTEGRATION
// ==============================

export const googleDriveCredentials = pgTable('google_drive_credentials', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenExpiry: timestamp('token_expiry'),
  folderId: text('folder_id'),
  folderName: text('folder_name'),
  personaId: text('persona_id').references(() => aiPersonas.id, { onDelete: 'set null' }),
  lastSyncAt: timestamp('last_sync_at'),
  syncIntervalMinutes: integer('sync_interval_minutes').default(5),
  watchChannelId: text('watch_channel_id'),
  watchResourceId: text('watch_resource_id'),
  watchExpiry: timestamp('watch_expiry'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const googleDriveCredentialsRelations = relations(googleDriveCredentials, ({ one }) => ({
  company: one(companies, {
    fields: [googleDriveCredentials.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [googleDriveCredentials.userId],
    references: [users.id],
  }),
  persona: one(aiPersonas, {
    fields: [googleDriveCredentials.personaId],
    references: [aiPersonas.id],
  }),
}));

// ==============================
// AUTOMATION FLOWS (VISUAL BUILDER)
// ==============================

export const automationFlows = pgTable('automation_flows', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  visualData: jsonb('visual_data').notNull(), // Armazena nodes e edges do @xyflow
  executionLogic: jsonb('execution_logic'), // Lógica otimizada para o backend
  triggerType: text('trigger_type').default('stage_entry').notNull(),
  webhookToken: text('webhook_token'),
  scheduleConfig: jsonb('schedule_config'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const automationFlowExecutions = pgTable('automation_flow_executions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  flowId: text('flow_id').notNull().references(() => automationFlows.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  status: text('status').notNull(), // 'running', 'completed', 'failed', 'paused'
  currentStepId: text('current_step_id'),
  variables: jsonb('variables').default({}),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
});

// ==============================
// AUTOMATION NODES (V3 — NORMALIZED)
// ==============================

export const automationNodes = pgTable('automation_nodes', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  automationId: text('automation_id').notNull().references(() => automationFlows.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  nodeType: text('node_type').notNull(),
  label: text('label'),
  config: jsonb('config').default({}),
  positionX: numeric('position_x').default('0'),
  positionY: numeric('position_y').default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const automationEdges = pgTable('automation_edges', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  automationId: text('automation_id').notNull().references(() => automationFlows.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  sourceNodeId: text('source_node_id').notNull().references(() => automationNodes.id, { onDelete: 'cascade' }),
  targetNodeId: text('target_node_id').notNull().references(() => automationNodes.id, { onDelete: 'cascade' }),
  sourceHandleId: text('source_handle_id'),
  conditionLabel: text('condition_label'),
  conditionValue: text('condition_value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const automationExecutionLogs = pgTable('automation_execution_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  executionId: text('execution_id').notNull().references(() => automationFlowExecutions.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  nodeType: text('node_type'),
  status: text('status').default('ok').notNull(),
  message: text('message'),
  inputData: jsonb('input_data').$type<Record<string, any>>(),
  outputData: jsonb('output_data').$type<Record<string, any>>(),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const automationNodeStats = pgTable('automation_node_stats', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  nodeId: text('node_id').notNull().unique(),
  automationId: text('automation_id').notNull().references(() => automationFlows.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  totalReached: integer('total_reached').default(0).notNull(),
  totalResponded: integer('total_responded').default(0).notNull(),
  responses: jsonb('responses').default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const automationFlowsRelations = relations(automationFlows, ({ one, many }) => ({
  company: one(companies, {
    fields: [automationFlows.companyId],
    references: [companies.id],
  }),
  executions: many(automationFlowExecutions),
}));

export const automationFlowExecutionsRelations = relations(automationFlowExecutions, ({ one }) => ({
  company: one(companies, {
    fields: [automationFlowExecutions.companyId],
    references: [companies.id],
  }),
  flow: one(automationFlows, {
    fields: [automationFlowExecutions.flowId],
    references: [automationFlows.id],
  }),
  contact: one(contacts, {
    fields: [automationFlowExecutions.contactId],
    references: [contacts.id],
  }),
}));

// ==============================
// MARKETING (Migrado de Vittaia-Main)
// ==============================

export const marketingCredentials = pgTable('marketing_credentials', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  status: text('status').notNull(),
  credentials: jsonb('credentials').$type<Record<string, any>>(),
  connectedAt: timestamp('connected_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyPlatformUnique: unique('marketing_credentials_company_platform_unique').on(table.companyId, table.platform),
}));

export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  campaignId: text('campaign_id').notNull(),
  campaignName: text('campaign_name'),
  status: text('status'),
  objective: text('objective'),
  impressions: integer('impressions').default(0).notNull(),
  clicks: integer('clicks').default(0).notNull(),
  spend: numeric('spend').default('0').notNull(),
  conversions: integer('conversions').default(0).notNull(),
  ctr: numeric('ctr').default('0').notNull(),
  cpc: numeric('cpc').default('0').notNull(),
  cpm: numeric('cpm').default('0').notNull(),
  roas: numeric('roas').default('0').notNull(),
  reach: integer('reach').default(0),
  frequency: numeric('frequency').default('0'),
  costPerLead: numeric('cost_per_lead'),
  dateStart: timestamp('date_start', { mode: 'string' }),
  dateEnd: timestamp('date_end', { mode: 'string' }),
  rawData: jsonb('raw_data').$type<Record<string, any>>(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
}, (table) => ({
  companyCampaignUnique: unique('marketing_campaigns_company_campaign_unique').on(table.companyId, table.campaignId),
}));

export const marketingAdsets = pgTable('marketing_adsets', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  campaignId: text('campaign_id').notNull(),
  adsetId: text('adset_id').notNull(),
  adsetName: text('adset_name'),
  status: text('status'),
  dailyBudget: numeric('daily_budget'),
  lifetimeBudget: numeric('lifetime_budget'),
  optimizationGoal: text('optimization_goal'),
  impressions: integer('impressions').default(0).notNull(),
  clicks: integer('clicks').default(0).notNull(),
  spend: numeric('spend').default('0').notNull(),
  conversions: integer('conversions').default(0).notNull(),
  ctr: numeric('ctr').default('0').notNull(),
  cpc: numeric('cpc').default('0').notNull(),
  cpm: numeric('cpm').default('0').notNull(),
  reach: integer('reach').default(0),
  frequency: numeric('frequency').default('0'),
  costPerLead: numeric('cost_per_lead'),
  rawData: jsonb('raw_data').$type<Record<string, any>>(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
}, (table) => ({
  companyAdsetUnique: unique('marketing_adsets_company_adset_unique').on(table.companyId, table.adsetId),
}));

export const marketingAds = pgTable('marketing_ads', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  adsetId: text('adset_id').notNull(),
  campaignId: text('campaign_id').notNull(),
  adId: text('ad_id').notNull(),
  adName: text('ad_name'),
  status: text('status'),
  impressions: integer('impressions').default(0).notNull(),
  clicks: integer('clicks').default(0).notNull(),
  spend: numeric('spend').default('0').notNull(),
  conversions: integer('conversions').default(0).notNull(),
  ctr: numeric('ctr').default('0').notNull(),
  cpc: numeric('cpc').default('0').notNull(),
  cpm: numeric('cpm').default('0').notNull(),
  reach: integer('reach').default(0),
  frequency: numeric('frequency').default('0'),
  costPerLead: numeric('cost_per_lead'),
  creativeThumbnailUrl: text('creative_thumbnail_url'),
  creativeBody: text('creative_body'),
  creativeTitle: text('creative_title'),
  rawData: jsonb('raw_data').$type<Record<string, any>>(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
}, (table) => ({
  companyAdUnique: unique('marketing_ads_company_ad_unique').on(table.companyId, table.adId),
}));

export const marketingSocialProfiles = pgTable('marketing_social_profiles', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  profileId: text('profile_id').notNull(),
  profileName: text('profile_name'),
  profilePictureUrl: text('profile_picture_url'),
  followersCount: integer('followers_count').default(0),
  followsCount: integer('follows_count').default(0),
  postsCount: integer('posts_count').default(0),
  pageLikes: integer('page_likes').default(0),
  pageReach: integer('page_reach').default(0),
  engagementRate: numeric('engagement_rate').default('0'),
  recentPosts: jsonb('recent_posts').$type<any[]>(),
  rawData: jsonb('raw_data').$type<Record<string, any>>(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyPlatformProfileUnique: unique('marketing_profiles_company_platform_profile_unique').on(table.companyId, table.platform, table.profileId),
}));

// ==============================
// DIAGNÓSTICO DE LEADS E CRM (Fase 10)
// ==============================

export const leadDiagnostics = pgTable('lead_diagnostics', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  referenceMonth: text('reference_month').notNull(), // format YYYY-MM
  totalLeads: integer('total_leads').default(0).notNull(),
  meetingsScheduled: integer('meetings_scheduled').default(0).notNull(),
  meetingsDone: integer('meetings_done').default(0).notNull(),
  noShow: integer('no_show').default(0).notNull(),
  contractsWon: integer('contracts_won').default(0).notNull(),
  ltvTotal: numeric('ltv_total').default('0').notNull(),
  adSpend: numeric('ad_spend').default('0').notNull(),
  commissionRate: numeric('commission_rate').default('10').notNull(),
  cpl: numeric('cpl').default('0'),
  meetingRate: numeric('meeting_rate').default('0'),
  cprf: numeric('cprf').default('0'),
  conversionRate: numeric('conversion_rate').default('0'),
  cacMarketing: numeric('cac_marketing').default('0'),
  cacApproximate: numeric('cac_approximate').default('0'),
  ticketMedio: numeric('ticket_medio').default('0'),
  mrr: numeric('mrr').default('0'),
  roas: numeric('roas').default('0'),
  commissionTotal: numeric('commission_total').default('0'),
  closersResult: numeric('closers_result').default('0'),
  campaignName: text('campaign_name'),
  campaignPlatform: text('campaign_platform'),
  campaignImpressions: integer('campaign_impressions').default(0),
  campaignClicks: integer('campaign_clicks').default(0),
  campaignCtr: numeric('campaign_ctr').default('0'),
  campaignCpc: numeric('campaign_cpc').default('0'),
  campaignConversions: integer('campaign_conversions').default(0),
  campaignCostPerConversion: numeric('campaign_cost_per_conversion').default('0'),
  campaignNotes: text('campaign_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyMonthUnique: unique('lead_diagnostics_company_month_unique').on(table.companyId, table.referenceMonth),
}));

export const agentCommissions = pgTable('agent_commissions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  commissionType: text('commission_type').default('percentage').notNull(),
  fixedValue: numeric('fixed_value').default('0').notNull(),
  percentageValue: numeric('percentage_value').default('0').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyUserUnique: unique('agent_commissions_company_user_unique').on(table.companyId, table.userId),
}));

export const funnels = pgTable('funnels', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  visualizationType: text('visualization_type').default('funnel').notNull(),
  tagOrder: jsonb('tag_order').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const funnelStages = pgTable('funnel_stages', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  funnelId: text('funnel_id').notNull().references(() => funnels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chatFunnelStage = pgTable('chat_funnel_stage', {
  chatId: text('chat_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  funnelId: text('funnel_id').notNull().references(() => funnels.id, { onDelete: 'cascade' }),
  stageId: text('stage_id').notNull().references(() => funnelStages.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').defaultNow().notNull()
}, (t) => ({
  pk: primaryKey({ columns: [t.chatId, t.funnelId] }),
}));

// ==============================
// MÓDULO AGÊNCIA — GESTÃO DE MARKETING
// ==============================

export const agencyClientStatusEnum = pgEnum('agency_client_status', [
  'onboarding', 'active', 'paused', 'reviewing', 'finished',
]);

export const agencyContentStatusEnum = pgEnum('agency_content_status', [
  'idea', 'in_production', 'in_editing', 'in_approval',
  'approved', 'scheduled', 'published', 'delayed',
]);

export const agencyCampaignStageEnum = pgEnum('agency_campaign_stage', [
  'not_started', 'strategic_planning', 'creative_planning',
  'schedule_execution', 'post_sale', 'finished',
]);

export const agencyMaterialStatusEnum = pgEnum('agency_material_status', [
  'received', 'analyzing', 'approved', 'rejected', 'needs_update', 'archived',
]);

export const agencyApprovalStatusEnum = pgEnum('agency_approval_status', [
  'waiting', 'approved', 'rejected', 'change_requested', 'approved_with_notes',
]);

export const agencyClients = pgTable('agency_clients', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  // Identificação
  name: text('name').notNull(),
  companyName: text('company_name'),
  niche: text('niche'),
  specialty: text('specialty'),
  city: text('city'),
  state: text('state'),
  // Contato
  instagram: text('instagram'),
  site: text('site'),
  whatsapp: text('whatsapp'),
  // Responsáveis
  managerId: text('manager_id').references(() => users.id, { onDelete: 'set null' }),
  designerId: text('designer_id').references(() => users.id, { onDelete: 'set null' }),
  trafficManagerId: text('traffic_manager_id').references(() => users.id, { onDelete: 'set null' }),
  copywriterId: text('copywriter_id').references(() => users.id, { onDelete: 'set null' }),
  // Contrato
  plan: text('plan').$type<'ouro' | 'prata' | 'bronze'>().default('bronze'),
  startDate: date('start_date'),
  nextDelivery: date('next_delivery'),
  // Status
  status: agencyClientStatusEnum('status').default('onboarding').notNull(),
  notes: text('notes'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS agency_clients_company_status_idx ON ${table} (company_id, status) WHERE deleted_at IS NULL`,
  companyCreatedAtIdx: sql`CREATE INDEX IF NOT EXISTS agency_clients_company_created_at_idx ON ${table} (company_id, created_at DESC) WHERE deleted_at IS NULL`,
}));

export const agencyContents = pgTable('agency_contents', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => agencyClients.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id'),
  // Identificação
  title: text('title').notNull(),
  contentType: text('content_type').$type<'autoridade' | 'atração' | 'conexão' | 'prova_social'>(),
  format: text('format'), // card, carrossel, reels, shorts, story, etc.
  sector: text('sector'), // juridico, gestao, designer, etc.
  method: text('method'), // high_demand, gold_experience, etc.
  stage: text('stage'), // reunioes, instagram, youtube, etc.
  channel: text('channel'), // instagram, youtube, whatsapp, etc.
  // Conteúdo
  briefing: text('briefing'),
  script: text('script'),
  caption: text('caption'),
  references: text('references'),
  // Metadados
  urgency: text('urgency').$type<'low' | 'normal' | 'high' | 'urgent'>().default('normal'),
  status: agencyContentStatusEnum('status').default('idea').notNull(),
  approvalStatus: text('approval_status').$type<'pending' | 'approved' | 'rejected' | 'changes_requested'>(),
  deadline: date('deadline'),
  publishDate: date('publish_date'),
  publishedAt: timestamp('published_at'),
  // Responsáveis
  responsibleId: text('responsible_id').references(() => users.id, { onDelete: 'set null' }),
  requesterId: text('requester_id').references(() => users.id, { onDelete: 'set null' }),
  // Flags
  hasCover: boolean('has_cover').default(false).notNull(),
  hasVideo: boolean('has_video').default(false).notNull(),
  hasReport: boolean('has_report').default(false).notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  observations: text('observations'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  clientStatusIdx: sql`CREATE INDEX IF NOT EXISTS agency_contents_client_status_idx ON ${table} (client_id, status)`,
  clientDeadlineIdx: sql`CREATE INDEX IF NOT EXISTS agency_contents_client_deadline_idx ON ${table} (client_id, deadline)`,
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS agency_contents_company_status_idx ON ${table} (company_id, status)`,
}));

export const agencyCampaigns = pgTable('agency_campaigns', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => agencyClients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  month: text('month'), // formato: "2025-05"
  plan: text('plan').$type<'ouro' | 'prata' | 'bronze'>(),
  objective: text('objective'),
  mainOffer: text('main_offer'),
  channel: text('channel'),
  stage: agencyCampaignStageEnum('stage').default('not_started').notNull(),
  // Responsáveis
  strategicManagerId: text('strategic_manager_id').references(() => users.id, { onDelete: 'set null' }),
  designerId: text('designer_id').references(() => users.id, { onDelete: 'set null' }),
  copywriterId: text('copywriter_id').references(() => users.id, { onDelete: 'set null' }),
  trafficManagerId: text('traffic_manager_id').references(() => users.id, { onDelete: 'set null' }),
  // Datas
  startDate: date('start_date'),
  deliveryDate: date('delivery_date'),
  // Checklist interno (JSONB)
  checklist: jsonb('checklist').$type<Record<string, boolean>>().default({}),
  observations: text('observations'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  clientStageIdx: sql`CREATE INDEX IF NOT EXISTS agency_campaigns_client_stage_idx ON ${table} (client_id, stage)`,
  companyMonthIdx: sql`CREATE INDEX IF NOT EXISTS agency_campaigns_company_month_idx ON ${table} (company_id, month)`,
}));

export const agencyMaterials = pgTable('agency_materials', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => agencyClients.id, { onDelete: 'cascade' }),
  // Identificação
  name: text('name').notNull(),
  category: text('category').notNull(), // branding, logo, ensaio, banco_imagens, etc.
  fileType: text('file_type'), // png, jpg, svg, pdf, mp4, link
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  // Armazenamento
  s3Key: text('s3_key'),
  s3Url: text('s3_url'),
  externalLink: text('external_link'),
  thumbnailUrl: text('thumbnail_url'),
  // Metadados
  tags: text('tags').array(),
  status: agencyMaterialStatusEnum('status').default('received').notNull(),
  observations: text('observations'),
  // Responsáveis
  uploadedById: text('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
  specialty: text('specialty'),
  // Vinculações
  linkedContentId: text('linked_content_id').references(() => agencyContents.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  clientCategoryIdx: sql`CREATE INDEX IF NOT EXISTS agency_materials_client_category_idx ON ${table} (client_id, category)`,
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS agency_materials_company_status_idx ON ${table} (company_id, status)`,
}));

export const agencyTasks = pgTable('agency_tasks', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  clientId: text('client_id').references(() => agencyClients.id, { onDelete: 'cascade' }),
  // Entidade vinculada (polimórfico)
  entityType: text('entity_type').$type<'content' | 'campaign' | 'material' | 'client' | 'approval'>(),
  entityId: text('entity_id'),
  // Tarefa
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority').$type<'low' | 'normal' | 'high' | 'urgent'>().default('normal'),
  status: text('status').$type<'pending' | 'in_progress' | 'done' | 'cancelled'>().default('pending').notNull(),
  // Responsável
  assignedToId: text('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
  createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS agency_tasks_company_status_idx ON ${table} (company_id, status)`,
  assignedToIdx: sql`CREATE INDEX IF NOT EXISTS agency_tasks_assigned_to_idx ON ${table} (assigned_to_id, status)`,
}));

export const agencyApprovals = pgTable('agency_approvals', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  clientId: text('client_id').references(() => agencyClients.id, { onDelete: 'cascade' }),
  // Entidade vinculada
  entityType: text('entity_type').$type<'content' | 'campaign' | 'material'>().notNull(),
  entityId: text('entity_id').notNull(),
  // Aprovação
  title: text('title').notNull(),
  type: text('type').$type<'internal' | 'client'>().default('internal').notNull(),
  status: agencyApprovalStatusEnum('status').default('waiting').notNull(),
  // Solicitação
  requestedById: text('requested_by_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedById: text('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
  deadlineAt: timestamp('deadline_at'),
  reviewedAt: timestamp('reviewed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyStatusIdx: sql`CREATE INDEX IF NOT EXISTS agency_approvals_company_status_idx ON ${table} (company_id, status)`,
  entityIdx: sql`CREATE INDEX IF NOT EXISTS agency_approvals_entity_idx ON ${table} (entity_type, entity_id)`,
}));

export const agencyComments = pgTable('agency_comments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  // Entidade vinculada (polimórfico)
  entityType: text('entity_type').$type<'content' | 'campaign' | 'material' | 'approval' | 'client'>().notNull(),
  entityId: text('entity_id').notNull(),
  // Comentário
  content: text('content').notNull(),
  authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
  parentId: text('parent_id'), // para replies
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  entityIdx: sql`CREATE INDEX IF NOT EXISTS agency_comments_entity_idx ON ${table} (entity_type, entity_id)`,
  companyCreatedAtIdx: sql`CREATE INDEX IF NOT EXISTS agency_comments_company_created_at_idx ON ${table} (company_id, created_at DESC)`,
}));

// Relations for Agency module
export const agencyClientsRelations = relations(agencyClients, ({ one, many }) => ({
  company: one(companies, { fields: [agencyClients.companyId], references: [companies.id] }),
  manager: one(users, { fields: [agencyClients.managerId], references: [users.id], relationName: 'agencyClientManager' }),
  designer: one(users, { fields: [agencyClients.designerId], references: [users.id], relationName: 'agencyClientDesigner' }),
  trafficManager: one(users, { fields: [agencyClients.trafficManagerId], references: [users.id], relationName: 'agencyClientTrafficManager' }),
  copywriter: one(users, { fields: [agencyClients.copywriterId], references: [users.id], relationName: 'agencyClientCopywriter' }),
  contents: many(agencyContents),
  campaigns: many(agencyCampaigns),
  materials: many(agencyMaterials),
  tasks: many(agencyTasks),
}));

export const agencyContentsRelations = relations(agencyContents, ({ one }) => ({
  client: one(agencyClients, { fields: [agencyContents.clientId], references: [agencyClients.id] }),
  company: one(companies, { fields: [agencyContents.companyId], references: [companies.id] }),
  responsible: one(users, { fields: [agencyContents.responsibleId], references: [users.id], relationName: 'agencyContentResponsible' }),
  requester: one(users, { fields: [agencyContents.requesterId], references: [users.id], relationName: 'agencyContentRequester' }),
}));

export const agencyCampaignsRelations = relations(agencyCampaigns, ({ one }) => ({
  client: one(agencyClients, { fields: [agencyCampaigns.clientId], references: [agencyClients.id] }),
  company: one(companies, { fields: [agencyCampaigns.companyId], references: [companies.id] }),
  strategicManager: one(users, { fields: [agencyCampaigns.strategicManagerId], references: [users.id], relationName: 'agencyCampaignStrategicManager' }),
  designer: one(users, { fields: [agencyCampaigns.designerId], references: [users.id], relationName: 'agencyCampaignDesigner' }),
}));

export const agencyMaterialsRelations = relations(agencyMaterials, ({ one }) => ({
  client: one(agencyClients, { fields: [agencyMaterials.clientId], references: [agencyClients.id] }),
  company: one(companies, { fields: [agencyMaterials.companyId], references: [companies.id] }),
  uploadedBy: one(users, { fields: [agencyMaterials.uploadedById], references: [users.id] }),
  linkedContent: one(agencyContents, { fields: [agencyMaterials.linkedContentId], references: [agencyContents.id] }),
}));

// CONTACT EVENTS (TIMELINE)
export const contactEvents = pgTable('contact_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'ASSIGNMENT', 'TAG', 'KANBAN', 'AUTOMATION', 'SYSTEM'
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  contactIdx: sql`CREATE INDEX IF NOT EXISTS contact_events_contact_idx ON ${table} (contact_id, created_at DESC)`,
  companyIdx: sql`CREATE INDEX IF NOT EXISTS contact_events_company_idx ON ${table} (company_id, created_at DESC)`,
}));

export const contactEventsRelations = relations(contactEvents, ({ one }) => ({
  company: one(companies, { fields: [contactEvents.companyId], references: [companies.id] }),
  contact: one(contacts, { fields: [contactEvents.contactId], references: [contacts.id] }),
}));

// ==============================
// AGENDA E BOOKING
// ==============================

export const calendars = pgTable('calendars', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  isGeneral: boolean('is_general').default(false),
  color: varchar('color', { length: 50 }),
  orderPosition: integer('order_position').default(0),
  googleCalendarId: text('google_calendar_id'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  calendarId: text('calendar_id').references(() => calendars.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  location: text('location'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  allDay: boolean('all_day').default(false),
  color: varchar('color', { length: 50 }),
  contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  attendanceStatus: varchar('attendance_status', { length: 50 }),
  googleEventId: text('google_event_id'),
  syncSource: varchar('sync_source', { length: 50 }),
  syncedFromGoogle: boolean('synced_from_google').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  dueDate: date('due_date'),
  dueTime: time('due_time'),
  priority: varchar('priority', { length: 50 }),
  completed: boolean('completed').default(false),
  contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const bookingConfig = pgTable('booking_config', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().unique().references(() => companies.id, { onDelete: 'cascade' }),
  calendarId: text('calendar_id').references(() => calendars.id, { onDelete: 'set null' }),
  active: boolean('active').default(true),
  widgetTitle: varchar('widget_title', { length: 255 }),
  widgetDescription: text('widget_description'),
  primaryColor: varchar('primary_color', { length: 50 }),
  services: jsonb('services'),
  workingDays: integer('working_days').array(),
  startTime: time('start_time').default('09:00'),
  endTime: time('end_time').default('18:00'),
  slotDurationMinutes: integer('slot_duration_minutes').default(30),
  bufferMinutes: integer('buffer_minutes').default(0),
  minAdvanceHours: integer('min_advance_hours').default(24),
  maxAdvanceDays: integer('max_advance_days').default(30),
  requireEmail: boolean('require_email').default(false),
  requirePhone: boolean('require_phone').default(true),
  requireNotes: boolean('require_notes').default(false),
  sendConfirmationWebhook: boolean('send_confirmation_webhook').default(false),
  autoAssignAgentId: text('auto_assign_agent_id').references(() => users.id, { onDelete: 'set null' }),
  autoCreateChat: boolean('auto_create_chat').default(true),
  autoAssignFunnelId: text('auto_assign_funnel_id').references(() => kanbanBoards.id, { onDelete: 'set null' }),
  autoAssignStageId: text('auto_assign_stage_id'),
  autoApplyTagId: text('auto_apply_tag_id').references(() => tags.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  calendarEventId: text('calendar_event_id').references(() => calendarEvents.id, { onDelete: 'set null' }),
  contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  clientName: varchar('client_name', { length: 255 }).notNull(),
  clientPhone: varchar('client_phone', { length: 50 }).notNull(),
  clientEmail: varchar('client_email', { length: 255 }),
  clientNotes: text('client_notes'),
  serviceName: varchar('service_name', { length: 255 }),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: varchar('status', { length: 50 }).default('CONFIRMED'),
  cancellationReason: text('cancellation_reason'),
  cancellationToken: text('cancellation_token'),
  cancelledAt: timestamp('cancelled_at'),
  syncSource: varchar('sync_source', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});
