// src/services/webhook-auto-approach.service.ts
// Agente de Abordagem Automática via Webhook
// Envia mensagem de primeiro contato para leads recebidos via webhook de entrada

import { conn } from '@/lib/db';
import { sendUnifiedMessage } from '@/services/unified-message-sender.service';

const logger = {
    info: (msg: string, data?: any) => console.log(`[AUTO-APPROACH] ${msg}`, data || ''),
    error: (msg: string, error?: any) => console.error(`[AUTO-APPROACH-ERROR] ${msg}`, error || ''),
    warn: (msg: string, data?: any) => console.warn(`[AUTO-APPROACH-WARN] ${msg}`, data || ''),
};

// ============================================
// TYPES
// ============================================

export interface AutoApproachConfig {
    auto_approach_enabled: boolean;
    auto_approach_connection_id: string | null;
    auto_approach_message: string;
    auto_approach_delay_seconds: number;
    auto_approach_ai_persona_id: string | null;
}

export interface AutoApproachContext {
    companyId: string;
    webhookConfigId: string;
    webhookName: string;
    contactId: string;
    phone: string;
    contactName: string;
    contactEmail: string;
    eventId?: string;
    payload: Record<string, any>;
}

// ============================================
// PHONE EXTRACTION
// ============================================

/**
 * Extracts phone number from various webhook payload formats.
 * Supports: Grapfy nested, flat forms, Kommo, generic CRM payloads.
 */
export function extractPhoneFromPayload(payload: Record<string, any>): string {
    // 1. Grapfy nested format: { customer: { phoneNumber: "..." } }
    if (typeof payload.customer === 'object' && payload.customer !== null) {
        const phone = payload.customer.phoneNumber || payload.customer.phone || payload.customer.celular || payload.customer.mobile;
        if (phone) return normalizePhone(String(phone));
    }

    // 2. Flat fields (form submissions, generic)
    const phoneFields = [
        'telefone', 'phone', 'Phone', 'phoneNumber', 'PhoneNumber',
        'whatsapp', 'Whatsapp', 'celular', 'Celular', 'mobile', 'Mobile',
        'tel', 'Tel', 'numero', 'Numero', 'contact_phone', 'lead_phone',
    ];

    for (const field of phoneFields) {
        if (payload[field] && typeof payload[field] === 'string') {
            const normalized = normalizePhone(payload[field]);
            if (normalized.length >= 10) return normalized;
        }
    }

    // 3. Nested data field: { data: { phone: "..." } }
    if (payload.data && typeof payload.data === 'object') {
        for (const field of phoneFields) {
            if (payload.data[field] && typeof payload.data[field] === 'string') {
                const normalized = normalizePhone(payload.data[field]);
                if (normalized.length >= 10) return normalized;
            }
        }
    }

    return '';
}

/**
 * Normalizes phone number: removes non-digits, ensures country code.
 */
function normalizePhone(phone: string): string {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // If starts with +, it was already provided
    if (phone.startsWith('+')) {
        return digits;
    }

    // Brazilian numbers: add country code if missing
    if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
    }

    return digits;
}

// ============================================
// EXTRACTION HELPERS
// ============================================

function extractNameFromPayload(payload: Record<string, any>): string {
    if (typeof payload.customer === 'object' && payload.customer?.name) return payload.customer.name;
    return payload.nome || payload.name || payload.Name || payload.nome_completo || payload.full_name || payload.customerName || '';
}

function extractEmailFromPayload(payload: Record<string, any>): string {
    if (typeof payload.customer === 'object' && payload.customer?.email) return payload.customer.email;
    return payload.email || payload.Email || payload.e_mail || '';
}

// ============================================
// VARIABLE INTERPOLATION
// ============================================

/**
 * Interpolates template variables in the approach message.
 */
function interpolateMessage(template: string, context: AutoApproachContext): string {
    const variables: Record<string, string> = {
        '{{nome}}': context.contactName || 'Cliente',
        '{{email}}': context.contactEmail || '',
        '{{telefone}}': context.phone || '',
        '{{objetivo}}': context.payload.objetivo || context.payload.assunto || context.payload.subject || '',
        '{{produto}}': (typeof context.payload.product === 'object' ? context.payload.product?.name : context.payload.product) || context.payload.productName || '',
        '{{origem}}': context.webhookName || 'Webhook',
        '{{data}}': new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replaceAll(key, value);
    }

    return result.trim();
}

// ============================================
// DEDUPLICATION
// ============================================

/**
 * Checks if this contact was already approached in the last N minutes.
 */
async function isDuplicateApproach(
    companyId: string,
    contactId: string,
    webhookConfigId: string,
    windowMinutes: number = 30
): Promise<boolean> {
    try {
        const result = await conn`
      SELECT id FROM webhook_approach_logs
      WHERE company_id = ${companyId}
        AND contact_id = ${contactId}
        AND webhook_config_id = ${webhookConfigId}
        AND status IN ('SENT', 'PENDING')
        AND created_at > NOW() - INTERVAL '${conn.unsafe(String(windowMinutes))} minutes'
      LIMIT 1
    `;
        return (result as any)?.length > 0;
    } catch (error) {
        logger.error('Dedup check failed', error);
        return false; // Fail open — better to send than to miss
    }
}

// ============================================
// RATE LIMITING
// ============================================

/**
 * Checks if company has exceeded the hourly approach limit.
 */
async function isRateLimited(companyId: string, maxPerHour: number = 60): Promise<boolean> {
    try {
        const result = await conn`
      SELECT COUNT(*)::int as count FROM webhook_approach_logs
      WHERE company_id = ${companyId}
        AND created_at > NOW() - INTERVAL '1 hour'
    `;
        const count = (result as any)?.[0]?.count || 0;
        return count >= maxPerHour;
    } catch (error) {
        logger.error('Rate limit check failed', error);
        return false;
    }
}

// ============================================
// CONNECTION RESOLVER
// ============================================

/**
 * Resolves connection type (baileys or apicloud) from connection ID.
 */
async function resolveConnectionType(connectionId: string, companyId: string): Promise<'baileys' | 'apicloud' | null> {
    try {
        const result = await conn`
      SELECT connection_type FROM connections
      WHERE id = ${connectionId} AND company_id = ${companyId}
      LIMIT 1
    `;
        const rawType = (result as any)?.[0]?.connection_type;

        // DIAGNOSTIC: log the raw DB value for troubleshooting
        logger.info(`[resolveConnectionType] Raw DB value: "${rawType}" for connectionId=${connectionId}`);

        if (!rawType) {
            logger.error(`[resolveConnectionType] No connection_type found`, { connectionId, companyId });
            return null;
        }

        const type = String(rawType).toLowerCase().trim();

        if (type === 'baileys') return 'baileys';

        // All Meta/APICLOUD variants → 'apicloud'
        if (type === 'apicloud' || type === 'cloud_api' || type === 'meta' || type === 'meta_api' ||
            type.includes('meta') || type.includes('api') || type.includes('cloud')) {
            logger.info(`[resolveConnectionType] Mapped "${rawType}" → "apicloud"`);
            return 'apicloud';
        }

        // Unknown type — default to apicloud since meta_api is the schema default
        logger.warn(`[resolveConnectionType] Unknown type "${rawType}", defaulting to "apicloud"`);
        return 'apicloud';
    } catch (error) {
        logger.error('Connection resolve failed', error);
        return null;
    }
}

// ============================================
// LOG APPROACH
// ============================================

async function logApproach(
    context: AutoApproachContext,
    config: AutoApproachConfig,
    messageSent: string,
    status: 'SENT' | 'FAILED' | 'PENDING' | 'SKIPPED',
    messageId?: string,
    error?: string
): Promise<void> {
    try {
        await conn`
      INSERT INTO webhook_approach_logs
      (company_id, webhook_config_id, contact_id, connection_id, phone, message_sent, message_id, status, error, approach_type, webhook_event_id, created_at)
      VALUES (
        ${context.companyId},
        ${context.webhookConfigId},
        ${context.contactId},
        ${config.auto_approach_connection_id || ''},
        ${context.phone},
        ${messageSent},
        ${messageId || null},
        ${status},
        ${error || null},
        ${config.auto_approach_ai_persona_id ? 'ai_persona' : 'template'},
        ${context.eventId || null},
        NOW()
      )
    `;
    } catch (logError) {
        logger.error('Failed to log approach', logError);
    }
}

// ============================================
// CREATE CONVERSATION + MESSAGE
// ============================================

async function createApproachConversation(
    companyId: string,
    contactId: string,
    connectionId: string,
    messageContent: string,
    providerMessageId: string | null,
    aiPersonaId?: string | null
): Promise<void> {
    try {
        // Find or create conversation
        const conversationResult = await conn`
      SELECT id FROM conversations
      WHERE contact_id = ${contactId} AND connection_id = ${connectionId}
      LIMIT 1
    `;

        let conversationId: string;

        if (conversationResult && (conversationResult as any).length > 0) {
            conversationId = (conversationResult as any)[0].id;
            // Update existing conversation
            await conn`
        UPDATE conversations SET
          last_message_at = NOW(),
          status = 'IN_PROGRESS',
          archived_at = NULL,
          archived_by = NULL,
          ai_active = COALESCE(ai_active, ${aiPersonaId ? true : false}),
          assigned_persona_id = COALESCE(assigned_persona_id, ${aiPersonaId || null})
        WHERE id = ${conversationId}
      `;
        } else {
            // Create new conversation
            const newConvo = await conn`
        INSERT INTO conversations (company_id, contact_id, connection_id, status, last_message_at, ai_active, assigned_persona_id)
        VALUES (${companyId}, ${contactId}, ${connectionId}, 'IN_PROGRESS', NOW(), ${aiPersonaId ? true : false}, ${aiPersonaId || null})
        RETURNING id
      `;
            conversationId = (newConvo as any)?.[0]?.id;
        }

        if (!conversationId) {
            logger.error('Failed to create/find conversation');
            return;
        }

        // Save the approach message
        await conn`
      INSERT INTO messages (company_id, conversation_id, provider_message_id, sender_type, content, content_type, status, sent_at)
      VALUES (${companyId}, ${conversationId}, ${providerMessageId}, 'SYSTEM', ${messageContent}, 'TEXT', 'SENT', NOW())
    `;

        logger.info('✅ Conversation + message created', { conversationId, contactId });
    } catch (error) {
        logger.error('Failed to create approach conversation', error);
    }
}

// ============================================
// MAIN: TRIGGER AUTO APPROACH
// ============================================

/**
 * Main entry point: called from incoming-handler after webhook processing.
 * Fire-and-forget — never blocks the webhook response.
 */
export async function triggerAutoApproach(
    companyId: string,
    webhookConfigId: string,
    webhookName: string,
    config: AutoApproachConfig,
    payload: Record<string, any>,
    contactId: string,
    phone: string,
    eventId?: string
): Promise<void> {
    try {
        // 1. Pre-checks
        if (!config.auto_approach_enabled) return;
        if (!config.auto_approach_connection_id) {
            logger.warn('Auto-approach enabled but no connection configured', { webhookConfigId });
            return;
        }
        if (!config.auto_approach_message && !config.auto_approach_ai_persona_id) {
            logger.warn('Auto-approach enabled but no message or persona configured', { webhookConfigId });
            return;
        }

        // Normalize phone
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone || normalizedPhone.length < 10) {
            logger.warn('Invalid phone for auto-approach', { phone, normalizedPhone });
            return;
        }

        const context: AutoApproachContext = {
            companyId,
            webhookConfigId,
            webhookName,
            contactId,
            phone: normalizedPhone,
            contactName: extractNameFromPayload(payload),
            contactEmail: extractEmailFromPayload(payload),
            eventId,
            payload,
        };

        // 2. Deduplication check
        const isDuplicate = await isDuplicateApproach(companyId, contactId, webhookConfigId);
        if (isDuplicate) {
            logger.info('⏭️ Skipping duplicate approach', { contactId, phone: normalizedPhone });
            await logApproach(context, config, '', 'SKIPPED', undefined, 'Duplicate approach within 30min window');
            return;
        }

        // 3. Rate limiting
        const isLimited = await isRateLimited(companyId);
        if (isLimited) {
            logger.warn('🚫 Rate limit exceeded for company', { companyId });
            await logApproach(context, config, '', 'SKIPPED', undefined, 'Rate limit exceeded (60/hour)');
            return;
        }

        // 4. Resolve connection type
        const connectionType = await resolveConnectionType(config.auto_approach_connection_id, companyId);
        if (!connectionType) {
            logger.error('Connection not found or invalid', { connectionId: config.auto_approach_connection_id });
            await logApproach(context, config, '', 'FAILED', undefined, 'Connection not found');
            return;
        }

        // 5. Apply delay
        const delayMs = Math.max(3, config.auto_approach_delay_seconds || 5) * 1000;
        logger.info(`⏳ Waiting ${delayMs}ms before approach...`, { phone: normalizedPhone });
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // 6. Detect template mode vs free-text mode
        const TEMPLATE_PREFIX = 'template:';
        const isTemplateMode = config.auto_approach_message?.startsWith(TEMPLATE_PREFIX);
        let templateId: string | undefined;
        let messageText: string;

        if (isTemplateMode) {
            // APICLOUD template mode — extract template ID
            templateId = config.auto_approach_message.slice(TEMPLATE_PREFIX.length);
            messageText = `[Template: ${templateId}]`; // For logging
            logger.info('📋 Using APICLOUD template mode', { templateId, phone: normalizedPhone });
        } else if (config.auto_approach_ai_persona_id) {
            // AI Persona mode — generate contextual message
            messageText = await generateAIApproachMessage(config.auto_approach_ai_persona_id, context);
            if (!messageText) {
                logger.error('AI persona failed to generate message, falling back to template');
                messageText = config.auto_approach_message
                    ? interpolateMessage(config.auto_approach_message, context)
                    : `Olá ${context.contactName || ''}! 👋 Recebemos seus dados e entraremos em contato em breve.`;
            }
        } else {
            // Free-text mode (Baileys) — interpolate variables
            messageText = interpolateMessage(config.auto_approach_message, context);
        }

        if (!isTemplateMode && !messageText.trim()) {
            logger.warn('Empty message after interpolation, skipping');
            await logApproach(context, config, '', 'SKIPPED', undefined, 'Empty message');
            return;
        }

        logger.info(`📤 Sending approach message`, {
            phone: normalizedPhone,
            provider: connectionType,
            messagePreview: messageText.substring(0, 80) + (messageText.length > 80 ? '...' : ''),
        });

        // 7. Send via unified sender
        const sendResult = await sendUnifiedMessage({
            provider: connectionType as 'baileys' | 'apicloud',
            connectionId: config.auto_approach_connection_id,
            to: normalizedPhone,
            message: isTemplateMode ? '' : messageText,
            ...(templateId ? {
                templateId,
                // Pass contact data as template params ({{1}} = name, {{2}} = webhook origin)
                templateParams: {
                    '1': context.contactName || 'Cliente',
                    '2': context.webhookName || '',
                    '3': context.contactEmail || '',
                },
            } : {}),
        });

        if (sendResult.success) {
            logger.info(`✅ Approach sent successfully`, {
                phone: normalizedPhone,
                messageId: sendResult.messageId,
            });

            // 8. Create conversation + message record
            await createApproachConversation(
                companyId,
                contactId,
                config.auto_approach_connection_id,
                messageText,
                sendResult.messageId || null,
                config.auto_approach_ai_persona_id || null
            );

            // 9. Log success
            await logApproach(context, config, messageText, 'SENT', sendResult.messageId);
        } else {
            logger.error(`❌ Approach send failed`, {
                phone: normalizedPhone,
                error: sendResult.error,
            });
            await logApproach(context, config, messageText, 'FAILED', undefined, sendResult.error);
        }
    } catch (error) {
        logger.error('Fatal error in triggerAutoApproach', error);
    }
}

// ============================================
// AI PERSONA MESSAGE GENERATION
// ============================================

async function generateAIApproachMessage(
    personaId: string,
    context: AutoApproachContext
): Promise<string> {
    try {
        // Fetch persona configuration
        const personaResult = await conn`
      SELECT name, system_prompt, knowledge_base, agent_type FROM ai_personas
      WHERE id = ${personaId} AND company_id = ${context.companyId}
      LIMIT 1
    `;

        const persona = (personaResult as any)?.[0];
        if (!persona) {
            logger.error('AI Persona not found', { personaId });
            return '';
        }

        // ============================================
        // BUILD RICH CONTEXT FROM FULL WEBHOOK PAYLOAD
        // ============================================

        // 1. Basic contact info (always available)
        const basicInfo = [
            context.contactName ? `Nome: ${context.contactName}` : '',
            context.contactEmail ? `Email: ${context.contactEmail}` : '',
            context.phone ? `Telefone: ${context.phone}` : '',
            context.webhookName ? `Origem/Fonte: ${context.webhookName}` : '',
        ].filter(Boolean).join('\n');

        // 2. Full payload — ALL form/quiz fields the contact submitted
        // Sanitize sensitive fields and format for AI readability
        const sensitiveKeys = ['password', 'senha', 'token', 'secret', 'credit_card', 'cpf', 'ssn'];
        const skipKeys = ['webhook_id', 'webhook_config_id', 'company_id', 'api_key', 'timestamp'];

        const formatPayloadForAI = (payload: Record<string, any>, prefix = ''): string => {
            const lines: string[] = [];
            for (const [key, value] of Object.entries(payload)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;

                // Skip sensitive or internal fields
                if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) continue;
                if (skipKeys.includes(key.toLowerCase())) continue;

                if (value === null || value === undefined || value === '') continue;

                if (typeof value === 'object' && !Array.isArray(value)) {
                    // Recurse into nested objects (e.g., customer: { name, phone })
                    lines.push(formatPayloadForAI(value, fullKey));
                } else if (Array.isArray(value)) {
                    lines.push(`  ${fullKey}: ${value.join(', ')}`);
                } else {
                    lines.push(`  ${fullKey}: ${String(value)}`);
                }
            }
            return lines.filter(Boolean).join('\n');
        };

        const fullPayloadFormatted = formatPayloadForAI(context.payload);

        // 3. Determine prompt style based on agent type
        const isAbordagemAgent = persona.agent_type === 'ABORDAGEM';

        // Use Gemini to generate approach message
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const { resolveAIKeys } = await import('@/lib/ai-keys-resolver');
        const resolvedKeys = await resolveAIKeys(context.companyId);
        const geminiKey = resolvedKeys.geminiApiKey;
        if (!geminiKey) throw new Error("Gemini API key not configured");
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = isAbordagemAgent
            ? `Você é "${persona.name}", um agente especializado em abordagem de leads que preencheram formulários/quiz.

MISSÃO: Gere UMA ÚNICA mensagem de abordagem para WhatsApp, PERSONALIZADA com base nos dados que o contato ACABOU de preencher num formulário/quiz.

REGRAS OBRIGATÓRIAS:
- Máximo 4 linhas curtas
- Tom conversacional, amigável e profissional
- USE o nome do contato
- REFERENCIE dados específicos que o contato preencheu (respostas do quiz, produto de interesse, preferências, etc.)
- O contato deve sentir que a mensagem foi escrita ESPECIFICAMENTE para ele
- NÃO repita todos os dados — escolha os mais relevantes para demonstrar atenção
- NÃO use saudações formais como "Prezado(a)"
- NÃO use links, URLs ou formatações markdown
- Termine com uma pergunta aberta e relevante ao que o contato demonstrou interesse

DADOS DO CONTATO (preenchidos pelo próprio contato):
${basicInfo}

DADOS COMPLETOS DO FORMULÁRIO/QUIZ:
${fullPayloadFormatted || '(nenhum dado adicional)'}

PERSONA/INSTRUÇÕES:
${(persona.system_prompt || '').substring(0, 800)}

Responda APENAS com a mensagem, sem aspas, sem explicações, sem comentários.`
            : `Você é "${persona.name}". Gere UMA ÚNICA mensagem de abordagem natural e amigável para WhatsApp.

REGRAS:
- Máximo 3 linhas curtas
- Tom conversacional e profissional
- Use o nome do contato se disponível
- Se houver dados do formulário, referencie algo relevante que o contato informou
- NÃO use saudações formais como "Prezado(a)"
- NÃO use links ou URLs
- Termine com uma pergunta aberta para engajar

DADOS DO CONTATO:
${basicInfo}

DADOS DO FORMULÁRIO/QUIZ (preenchidos pelo contato):
${fullPayloadFormatted || '(nenhum dado adicional)'}

PERSONA:
${(persona.system_prompt || '').substring(0, 500)}

Responda APENAS com a mensagem, sem aspas nem explicações.`;

        logger.info('📝 Generating AI approach message', {
            personaId,
            agentType: persona.agent_type,
            payloadKeys: Object.keys(context.payload),
            contactName: context.contactName,
        });

        const result = await model.generateContent(prompt);
        const text = result.response?.text()?.trim() || '';

        if (text.length > 500) {
            return text.substring(0, 500);
        }

        return text;
    } catch (error) {
        logger.error('AI approach generation failed', error);
        return '';
    }
}
