import { conn } from '@/lib/db';
import crypto from 'crypto';
import { IncomingWebhookPayload, IncomingEventType } from '@/types/incoming-webhook';
import { z } from 'zod';
import type { AutoApproachConfig } from '@/services/webhook-auto-approach.service';

const logger = {
  info: (msg: string, data?: any) => console.log(`[INCOMING-WEBHOOK] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[INCOMING-WEBHOOK-ERROR] ${msg}`, error || ''),
  warn: (msg: string, data?: any) => console.warn(`[INCOMING-WEBHOOK-WARN] ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.log(`[INCOMING-WEBHOOK-DEBUG] ${msg}`, data || ''),
};

/**
 * Normalize phone number: remove formatting chars and add Brazil country code
 * Converts "(64) 9 9952-6870" → "+5564999526870" (E.164 format, same as sanitizePhone)
 */
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  // Remove everything except digits
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // Remove leading 0 if present (e.g. 064...)
  if (digits.startsWith('0')) digits = digits.substring(1);
  // Add Brazil country code if not present
  if (!digits.startsWith('55') && digits.length <= 11) {
    digits = '55' + digits;
  }
  // Return in E.164 format (with +) to match sanitizePhone() used by Meta webhook
  return `+${digits}`;
}

// URL Configuration Logger
const _logWebhookConfig = (companyId: string, source: string) => {
  const baseUrl = process.env.DOMAIN || 'https://62863c59-d08b-44f5-a414-d7529041de1a-00-16zuyl87dp7m9.kirk.replit.dev';
  const webhookUrl = `${baseUrl}/api/v1/webhooks/incoming/${companyId}`;
  logger.info(`✅ Webhook URL for ${source}:`, webhookUrl);
};

// Validation schema for incoming webhook payload
// Supports both generic format (event_type + data) and Grapfy format (eventType + payload)
const webhookPayloadSchema = z.record(z.any()).transform((data) => {
  // Preserve ALL original data without modification
  return {
    event_type: data.event_type || data.eventType,
    timestamp: data.timestamp || (data.createdAt ? Math.floor(new Date(data.createdAt).getTime() / 1000) : undefined),
    // Preserve complete original payload
    ...data,
  };
});

export async function validateWebhookSignature(
  body: string,
  signature: string,
  timestamp: string,
  secret: string,
  isDev: boolean = false
): Promise<boolean> {
  // Allow unsigned requests in development mode
  if (isDev) {
    if (!signature) {
      logger.warn('✅ [DEV MODE] Development mode: allowing unsigned webhook');
      return true;
    }
  }

  if (!signature || !timestamp) {
    logger.error('❌ Missing signature or timestamp headers');
    return false;
  }

  // Check timestamp is within 5 minutes (anti-replay)
  const requestTime = parseInt(timestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(currentTime - requestTime);

  if (timeDiff > 300) { // 5 minutes
    logger.error('❌ Timestamp outside acceptable window', { timeDiff, requestTime, currentTime });
    return false;
  }

  // Compute expected signature: HMAC-SHA256(timestamp.body, secret)
  const payload = `${timestamp}.${body}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    ).valueOf();

    if (!isValid) {
      logger.error('❌ Signature mismatch', {
        received: signature.substring(0, 16) + '...',
        expected: expectedSignature.substring(0, 16) + '...',
      });
      return false;
    }

    logger.info('✅ Webhook signature validated successfully');
    return true;
  } catch (error) {
    logger.error('❌ Signature validation error:', error);
    return false;
  }
}

export async function parseAndValidatePayload(body: string): Promise<IncomingWebhookPayload | null> {
  try {
    const parsed = JSON.parse(body);
    logger.debug('Raw webhook payload:', { eventType: parsed.eventType || parsed.event_type, payloadKeys: Object.keys(parsed) });
    // Log actual field values for diagnosis
    const fieldSummary: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('_')) continue; // skip internal fields
      const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value || '');
      fieldSummary[key] = strVal.substring(0, 200);
    }
    logger.info('📋 Payload field VALUES:', fieldSummary);

    const validated = webhookPayloadSchema.safeParse(parsed);

    if (!validated.success) {
      logger.error('Payload validation failed', validated.error.flatten());
      logger.debug('Failed payload keys:', Object.keys(parsed));
      return null;
    }

    logger.info('✅ Webhook payload validated successfully', { event_type: validated.data.event_type });
    return validated.data as IncomingWebhookPayload;
  } catch (error) {
    logger.error('Failed to parse webhook body', error);
    return null;
  }
}

export async function storeWebhookEvent(
  companyId: string,
  source: string,
  eventType: IncomingEventType,
  payload: IncomingWebhookPayload,
  headers: Record<string, any>,
  ipAddress: string | undefined,
  signatureValid: boolean
): Promise<string | null> {
  try {
    // Coerce undefined values to null/defaults — postgres rejects undefined
    const safeEventType = eventType || 'unknown';
    const safePayload = JSON.stringify(payload || {});
    const safeHeaders = JSON.stringify(headers || {});
    const safeIpAddress = ipAddress || 'unknown';
    const safeSignatureValid = signatureValid ?? false;

    // Using postgres client directly for raw SQL
    const result = await conn`
      INSERT INTO incoming_webhook_events 
      (company_id, source, event_type, payload, headers, ip_address, signature_valid, processed_at, created_at)
      VALUES (${companyId}, ${source}, ${safeEventType}, ${safePayload}, ${safeHeaders}, ${safeIpAddress}, ${safeSignatureValid}, NOW(), NOW())
      RETURNING id
    `;

    const eventId = (result as any)?.[0]?.id;
    if (eventId) {
      logger.info(`Webhook event stored`, { eventId, companyId, source, eventType: safeEventType });
    }
    return eventId || null;
  } catch (error) {
    logger.error('Failed to store webhook event', error);
    return null;
  }
}

export async function handleIncomingWebhookEvent(
  companyId: string,
  source: string,
  payload: IncomingWebhookPayload,
  eventId: string,
  webhookName?: string,
  webhookConfig?: { id: string } & Partial<AutoApproachConfig>
): Promise<void> {
  try {
    let eventType = payload.event_type as IncomingEventType;

    // Auto-detect form submissions: no event_type but has email/__submission/nome keys
    if (!eventType) {
      const keys = Object.keys(payload || {});
      const hasFormIndicators = keys.some(k =>
        ['email', '__submission', 'nome', 'name', 'telefone', 'phone', 'objetivo', 'formulario'].includes(k.toLowerCase())
      );
      if (hasFormIndicators) {
        eventType = 'form.submitted' as IncomingEventType;
        logger.info(`Auto-detected form.submitted (no event_type, but has form keys)`, { keys });
      }
    }

    logger.info(`Processing incoming webhook event`, {
      eventId,
      companyId,
      source,
      eventType,
    });

    // Route event to specific handlers based on type
    switch (eventType) {
      case 'lead.created':
      case 'lead.updated':
      case 'lead.qualified':
        await handleLeadEvent(companyId, eventType, payload);
        break;

      case 'contact.created':
      case 'contact.updated':
      case 'contact.deleted':
        await handleContactEvent(companyId, eventType, payload);
        break;

      case 'message.received':
        await handleMessageEvent(companyId, payload);
        break;

      case 'form.submitted':
      case 'conversion.completed':
        await handleFormSubmittedEvent(companyId, payload, eventId, webhookName, webhookConfig);
        break;

      case 'pix_created':
      case 'order_approved':
        await handleGrapfyEvent(companyId, eventType, payload, webhookName, webhookConfig);
        break;

      case 'custom':
      default:
        // Even for unknown events, try form detection as last resort
        if (!eventType) {
          logger.info(`Unknown event with no type, storing as-is`, { eventId });
        } else {
          logger.info(`Custom event received: ${eventType}`, { eventId });
        }
        break;
    }

    logger.info(`Event processed successfully`, { eventId });
  } catch (error) {
    logger.error('Error handling webhook event', { eventId, error });
    throw error;
  }
}

// Specific event handlers
async function handleLeadEvent(
  companyId: string,
  eventType: string,
  payload: IncomingWebhookPayload
): Promise<void> {
  logger.info(`Processing lead event: ${eventType}`, payload.data);
  // Lead processing logic would go here
  // Could create/update leads based on payload data
}

async function handleContactEvent(
  companyId: string,
  eventType: string,
  payload: IncomingWebhookPayload
): Promise<void> {
  logger.info(`Processing contact event: ${eventType}`, payload.data);
  // Contact processing logic would go here
  // Could sync with contacts table
}

async function handleMessageEvent(
  companyId: string,
  payload: IncomingWebhookPayload
): Promise<void> {
  logger.info(`Processing incoming message`, payload.data);
  // Message processing logic
}

async function handleConversionEvent(
  companyId: string,
  eventType: string,
  payload: IncomingWebhookPayload,
  webhookName?: string
): Promise<void> {
  logger.info(`Processing conversion event: ${eventType}`, payload.data);
  // Redirect to form handler
  await handleFormSubmittedEvent(companyId, payload, 'conversion', webhookName);
}

/**
 * Handle form submissions: create/find contact + create lead in Kanban
 */
async function handleFormSubmittedEvent(
  companyId: string,
  payload: IncomingWebhookPayload,
  eventId: string,
  webhookName?: string,
  webhookConfig?: { id: string } & Partial<AutoApproachConfig>
): Promise<void> {
  try {
    const data = payload as Record<string, any>;

    // Extract contact fields from various possible key names
    const email = data.email || data.Email || data.e_mail || '';
    const name = data.nome || data.name || data.Name || data.nome_completo || data.full_name || email.split('@')[0] || 'Lead via Formulário';
    const rawPhone = data.telefone || data.phone || data.Phone || data.whatsapp || data.celular || data.mobile || '';
    const phone = normalizePhoneNumber(rawPhone);

    logger.info(`[FormHandler] 📞 Phone normalization: "${rawPhone}" → "${phone}"`);
    logger.info(`[FormHandler] 📋 Extracted fields:`, {
      nome_extraido: name,
      email_extraido: email,
      telefone_raw: rawPhone,
      telefone_normalizado: phone,
      companyId,
      totalPayloadKeys: Object.keys(data).length,
    });

    // Build notes from ALL form fields (formatted for readability)
    const excludeKeys = ['event_type', 'eventType', 'timestamp', '__submission', 'createdAt'];
    const formFields = Object.entries(data)
      .filter(([key]) => !excludeKeys.includes(key))
      .map(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
        return `• ${displayLabel}: ${typeof value === 'object' ? JSON.stringify(value) : value}`;
      })
      .join('\n');

    const notes = `📋 Dados do Formulário (${new Date().toLocaleDateString('pt-BR')}):\n${formFields}`;

    // 1. Find or create contact
    let contactId: string | null = null;

    // Try to find existing contact by email or phone
    if (email) {
      const existingByEmail = await conn`
        SELECT id FROM contacts 
        WHERE company_id = ${companyId} AND email = ${email} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (existingByEmail && (existingByEmail as any).length > 0) {
        contactId = (existingByEmail as any)[0].id;
        logger.info(`[FormHandler] Found existing contact by email`, { contactId, email });
      }
    }

    if (!contactId && phone) {
      // Generate phone variations for lookup (with/without 9th digit, with/without country code)
      const phoneVariations = [phone];
      // If phone has 13 digits (55 + DDD + 9 + 8 digits), also try without 9th digit
      if (phone.length === 13 && phone.charAt(4) === '9') {
        phoneVariations.push(phone.substring(0, 4) + phone.substring(5));
      }
      // If phone has 12 digits, also try with 9th digit
      if (phone.length === 12) {
        phoneVariations.push(phone.substring(0, 4) + '9' + phone.substring(4));
      }
      // Also try without country code
      if (phone.startsWith('55')) {
        phoneVariations.push(phone.substring(2));
      }

      const existingByPhone = await conn`
        SELECT id FROM contacts 
        WHERE company_id = ${companyId} AND phone = ANY(${phoneVariations}) AND deleted_at IS NULL
        LIMIT 1
      `;
      if (existingByPhone && (existingByPhone as any).length > 0) {
        contactId = (existingByPhone as any)[0].id;
        logger.info(`[FormHandler] Found existing contact by phone`, { contactId, phone, variations: phoneVariations });
      }
    }

    // Create contact if not found
    if (!contactId) {
      // phone is required in schema — use email-based placeholder if no phone provided
      const contactPhone = phone || `form_${email || Date.now()}`;
      const contactName = name || 'Lead Formulário';

      const newContact = await conn`
        INSERT INTO contacts (company_id, name, phone, email, status, created_at)
        VALUES (${companyId}, ${contactName}, ${contactPhone}, ${email || null}, 'ACTIVE', NOW())
        ON CONFLICT (phone, company_id) DO UPDATE SET
          email = COALESCE(EXCLUDED.email, contacts.email),
          name = CASE WHEN contacts.name = 'Lead Formulário' THEN EXCLUDED.name ELSE contacts.name END
        RETURNING id
      `;
      contactId = (newContact as any)?.[0]?.id;
      logger.info(`[FormHandler] Created/upserted contact`, { contactId, contactName, contactPhone });
    }

    if (!contactId) {
      logger.error(`[FormHandler] Failed to create contact — cannot create lead`);
      return;
    }

    // 1.3. Save custom fields to contact (structured JSONB)
    const standardKeys = ['event_type', 'eventType', 'timestamp', '__submission', 'createdAt', 'nome', 'name', 'Name', 'nome_completo', 'full_name', 'email', 'Email', 'e_mail', 'telefone', 'phone', 'Phone', 'whatsapp', 'celular', 'mobile'];
    // FluentForms internal fields — security tokens, form IDs, hidden metadata (noise for AI context)
    const fluentFormsNoisePatterns = ['fluentformnonce', '_fluentform', '__fluent', '_wp_http', '_token', 'nonce', 'form_id', 'formId', '_wp_nonce', 'action', 'referrer', 'referer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const customFieldEntries = Object.entries(data)
      .filter(([key]) => !standardKeys.includes(key))
      .filter(([key]) => !fluentFormsNoisePatterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase())))
      .filter(([_, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]);

    if (customFieldEntries.length > 0) {
      const customFieldsObj = Object.fromEntries(customFieldEntries);
      try {
        await conn`
          UPDATE contacts 
          SET custom_fields = ${JSON.stringify(customFieldsObj)}::jsonb
          WHERE id = ${contactId} AND company_id = ${companyId}
        `;
        logger.info(`[FormHandler] ✅ Saved ${customFieldEntries.length} custom fields to contact`, { contactId, fields: Object.keys(customFieldsObj) });
      } catch (cfError) {
        logger.warn(`[FormHandler] Failed to save custom fields (non-blocking):`, cfError);
      }
    }

    // 1.5. Auto-assign tag and list from webhook origin
    if (webhookName) {
      await assignWebhookOriginTagAndList(companyId, contactId, webhookName);
    }

    // 2. Find default Kanban board for this company
    const boards = await conn`
      SELECT id, stages FROM kanban_boards 
      WHERE company_id = ${companyId} 
      ORDER BY created_at ASC LIMIT 1
    `;

    if (!boards || (boards as any).length === 0) {
      logger.warn(`[FormHandler] No Kanban board found for company ${companyId} — skipping lead creation`);
      return;
    }

    const board = (boards as any)[0];
    const boardId = board.id;
    let stages: any[] = [];
    try {
      stages = typeof board.stages === 'string' ? JSON.parse(board.stages) : board.stages;
    } catch {
      stages = [];
    }

    if (!stages || stages.length === 0) {
      logger.warn(`[FormHandler] Board ${boardId} has no stages — skipping lead creation`);
      return;
    }

    const firstStageId = stages[0].id;

    // 3. Check if lead already exists for this contact in this board
    let leadId: string | null = null;
    const existingLead = await conn`
      SELECT id FROM kanban_leads 
      WHERE company_id = ${companyId} AND contact_id = ${contactId} AND board_id = ${boardId}
      LIMIT 1
    `;

    if (existingLead && (existingLead as any).length > 0) {
      // Update notes of existing lead
      leadId = (existingLead as any)[0].id;
      await conn`
        UPDATE kanban_leads 
        SET notes = COALESCE(notes, '') || E'\n\n' || ${notes}, updated_at = NOW()
        WHERE id = ${leadId}
      `;
      logger.info(`[FormHandler] ✅ Updated existing lead with form data`, { leadId, contactId });
    } else {
      // 4. Create lead in first stage
      const title = data.objetivo || data.assunto || data.subject || `Formulário — ${name}`;
      const newLead = await conn`
        INSERT INTO kanban_leads (company_id, board_id, stage_id, contact_id, title, notes, value, created_at, updated_at)
        VALUES (${companyId}, ${boardId}, ${firstStageId}, ${contactId}, ${title}, ${notes}, '0', NOW(), NOW())
        RETURNING id
      `;
      leadId = (newLead as any)?.[0]?.id;
      logger.info(`[FormHandler] ✅ Lead created from form submission`, { leadId, contactId, boardId, stageId: firstStageId });
    }

    // 🆕 KOMMO SYNC: Push lead to Kommo CRM (fire-and-forget)
    if (leadId && contactId) {
      import('@/services/kommo-lead-sync.service').then(({ pushLeadToKommo }) => {
        pushLeadToKommo(companyId, {
          leadId,
          contactId,
          contactName: name,
          contactPhone: phone,
          contactEmail: email,
          title: data.objetivo || data.assunto || data.subject || `Formulário — ${name}`,
          notes,
          source: webhookName || 'Formulário',
        }).catch(err => logger.warn('[FormHandler] Kommo sync failed (non-blocking):', err));
      }).catch(err => logger.warn('[FormHandler] Kommo sync import failed:', err));
    }

    // 🆕 AUTO-APPROACH: runs for BOTH new and existing leads
    if (webhookConfig?.auto_approach_enabled && contactId && phone) {
      logger.info(`[FormHandler] Triggering auto-approach`, { phone, contactId, webhookConfigId: webhookConfig.id });
      import('@/services/webhook-auto-approach.service').then(({ triggerAutoApproach }) => {
        triggerAutoApproach(
          companyId,
          webhookConfig.id,
          webhookName || 'Formulário',
          webhookConfig as AutoApproachConfig,
          data,
          contactId!,
          phone,
          eventId
        ).catch(err => logger.warn('[FormHandler] Auto-approach failed (non-blocking):', err));
      }).catch(err => logger.warn('[FormHandler] Auto-approach import failed:', err));
    } else {
      logger.info(`[FormHandler] Auto-approach skipped`, {
        enabled: webhookConfig?.auto_approach_enabled,
        hasContact: !!contactId,
        hasPhone: !!phone,
      });
    }

  } catch (error) {
    logger.error('[FormHandler] Error creating lead from form', error);
  }
}

/**
 * Auto-assign a tag and contact list based on the webhook origin name.
 * Creates the tag/list if they don't exist, then links the contact.
 */
async function assignWebhookOriginTagAndList(
  companyId: string,
  contactId: string,
  webhookName: string
): Promise<void> {
  try {
    if (!webhookName) return;

    logger.info(`[WebhookOrigin] Assigning tag+list "${webhookName}" to contact ${contactId}`);

    // 1. Create or find tag with ON CONFLICT
    const tagResult = await conn`
      INSERT INTO tags (company_id, name, color, created_at)
      VALUES (${companyId}, ${webhookName}, '#6366f1', NOW())
      ON CONFLICT (name, company_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const tagId = (tagResult as any)?.[0]?.id;

    if (tagId) {
      // Link contact to tag
      await conn`
        INSERT INTO contacts_to_tags (contact_id, tag_id, company_id)
        VALUES (${contactId}, ${tagId}, ${companyId})
        ON CONFLICT (contact_id, tag_id) DO NOTHING
      `;
      logger.info(`[WebhookOrigin] ✅ Tag "${webhookName}" assigned`, { tagId, contactId });
    }

    // 2. Create or find contact list with ON CONFLICT
    const listResult = await conn`
      INSERT INTO contact_lists (company_id, name, description, created_at)
      VALUES (${companyId}, ${webhookName}, ${'Contatos recebidos via webhook: ' + webhookName}, NOW())
      ON CONFLICT (name, company_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const listId = (listResult as any)?.[0]?.id;

    if (listId) {
      // Link contact to list
      await conn`
        INSERT INTO contacts_to_contact_lists (contact_id, list_id, company_id)
        VALUES (${contactId}, ${listId}, ${companyId})
        ON CONFLICT (contact_id, list_id) DO NOTHING
      `;
      logger.info(`[WebhookOrigin] ✅ List "${webhookName}" assigned`, { listId, contactId });
    }

  } catch (error) {
    logger.error(`[WebhookOrigin] Error assigning tag/list`, { error, webhookName, contactId });
  }
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****';
  return secret.substring(0, 4) + '****' + secret.substring(secret.length - 4);
}

// Grapfy event handler
async function handleGrapfyEvent(
  companyId: string,
  eventType: IncomingEventType,
  payload: IncomingWebhookPayload,
  webhookName?: string,
  webhookConfig?: { id: string } & Partial<AutoApproachConfig>
): Promise<void> {
  try {
    // Dados vêm diretamente no payload (não em payload.data)
    const data = payload as any;

    // ✅ FIX: Suportar AMBOS formatos - aninhado (Grapfy real) e plano (curl manual)
    // Formato aninhado: { customer: { name: "Diego", phoneNumber: "64999526870" } }
    // Formato plano: { customer: "Diego", phone: "64999526870" }

    let customer: { name?: string; email?: string; phoneNumber?: string; phone?: string; document?: string } = {};
    let product: { name?: string } = {};

    // Parse customer - pode ser objeto ou string
    if (typeof data.customer === 'object' && data.customer !== null) {
      customer = data.customer;
    } else if (typeof data.customer === 'string') {
      customer = { name: data.customer };
    }

    // Fallback para campos planos no root
    if (!customer.name && data.customerName) customer.name = data.customerName;
    if (!customer.email && data.email) customer.email = data.email;
    if (!customer.phoneNumber && data.phone) customer.phoneNumber = data.phone;
    if (!customer.phoneNumber && data.phoneNumber) customer.phoneNumber = data.phoneNumber;
    if (!customer.document && data.document) customer.document = data.document;

    // Parse product - pode ser objeto ou string
    if (typeof data.product === 'object' && data.product !== null) {
      product = data.product;
    } else if (typeof data.product === 'string') {
      product = { name: data.product };
    }

    // Fallback para campos planos no root
    if (!product.name && data.productName) product.name = data.productName;

    const _address = data.address || {};
    const total = data.total || 0;
    const _qrCode = data.qrCode || '';
    const _orderId = data.orderId || '';

    // Log detalhado do parsing
    logger.info(`Processing Grapfy event: ${eventType}`, {
      eventId: data.eventId,
      customer: customer.name || 'Unknown',
      email: customer.email || '',
      phone: customer.phoneNumber || customer.phone || '',
      product: product.name || '',
      total: total,
      status: data.status,
    });

    // Extract and normalize phone number
    const rawCustomerPhone = customer.phoneNumber || customer.phone || '';
    const normalizedCustomerPhone = rawCustomerPhone ? normalizePhoneNumber(rawCustomerPhone) : '';

    // ✅ CHANGE v2.10.6: Notifications ONLY via automations (must have active rules)
    // Removed: sendPixNotification() and sendOrderApprovedNotification()
    // These now run ONLY if user has configured automation rules in /automations

    // Import trigger service
    const { triggerWebhookCampaign } = await import('@/services/webhook-campaign-trigger.service');

    // Dispatch campaign based on event type
    await triggerWebhookCampaign({
      companyId,
      eventType,
      customer: {
        name: customer.name || 'Unknown',
        email: customer.email || '',
        phoneNumber: normalizedCustomerPhone, // Enviar telefone normalizado
        document: customer.document || '',
      },
      product: product.name ? { name: product.name } : undefined,
      plan: data.plan?.name ? { name: data.plan.name } : undefined,
    });

    // NEW: Trigger automation rules for webhook events
    try {
      const { triggerAutomationForWebhook } = await import('@/lib/automation-engine');
      await triggerAutomationForWebhook(companyId, eventType, data);
      logger.info(`✅ Automations triggered for webhook event: ${eventType}`);
    } catch (automationError) {
      logger.warn(`Automation trigger failed (non-blocking):`, automationError);
    }

    logger.info(`✅ Grapfy campaign triggered successfully for event: ${eventType}`);

    // 🆕 AUTO-APPROACH: Fire-and-forget approach message
    if (webhookConfig?.auto_approach_enabled && normalizedCustomerPhone) {
      // Find or create contact for approach
      try {
        let approachContactId: string | null = null;
        if (normalizedCustomerPhone) {
          const contactResult = await conn`
            SELECT id FROM contacts WHERE company_id = ${companyId} AND phone = ${normalizedCustomerPhone} LIMIT 1
          `;
          approachContactId = (contactResult as any)?.[0]?.id;
        }
        if (approachContactId) {
          const { triggerAutoApproach } = await import('@/services/webhook-auto-approach.service');
          triggerAutoApproach(
            companyId,
            webhookConfig.id,
            webhookName || 'Grapfy',
            webhookConfig as AutoApproachConfig,
            data,
            approachContactId,
            normalizedCustomerPhone,
            undefined
          ).catch(err => logger.warn('[Grapfy] Auto-approach failed (non-blocking):', err));
        }
      } catch (approachErr) {
        logger.warn('[Grapfy] Auto-approach setup failed (non-blocking):', approachErr);
      }
    }

  } catch (error) {
    logger.error('Error handling Grapfy event', { error, eventType });
  }
}

