// src/services/kommo-lead-sync.service.ts
// Kommo CRM Lead Sync Service
// Syncs MasterIA leads to Kommo CRM pipeline via API v4

import { db } from '@/lib/db';
import { crmIntegrations, crmAccounts, crmMappings, crmSyncLogs, kanbanLeads, contacts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

// ============================================
// TYPES
// ============================================

export interface KommoCredentials {
    domain: string;
    accessToken: string;
    integrationId: string;
    config?: Record<string, any> | null;
}

export interface KommoLeadData {
    leadId: string;
    contactId: string;
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    title?: string;
    notes?: string;
    value?: number;
    source?: string;
    metadata?: Record<string, any>;
}

interface KommoApiResponse {
    success: boolean;
    kommoLeadId?: number;
    kommoContactId?: number;
    error?: string;
}

// ============================================
// LOGGER
// ============================================

const logger = {
    info: (msg: string, data?: any) => console.log(`[KommoSync] ${msg}`, data || ''),
    error: (msg: string, error?: any) => console.error(`[KommoSync-ERROR] ${msg}`, error || ''),
    warn: (msg: string, data?: any) => console.warn(`[KommoSync-WARN] ${msg}`, data || ''),
};

// ============================================
// DEFAULT PIPELINE CONFIG
// ============================================

// EDN [ATUAL] pipeline in Kommo
const DEFAULT_KOMMO_PIPELINE_ID = 12215780;

// ============================================
// CREDENTIALS
// ============================================

/**
 * Get Kommo credentials for a company.
 * Returns null if no Kommo integration is configured.
 */
async function getKommoCredentials(companyId: string): Promise<KommoCredentials | null> {
    try {
        const [integration] = await db
            .select()
            .from(crmIntegrations)
            .where(
                and(
                    eq(crmIntegrations.companyId, companyId),
                    eq(crmIntegrations.provider, 'kommo')
                )
            )
            .limit(1);

        if (!integration || integration.status !== 'connected') {
            logger.warn(`No active Kommo integration for company ${companyId}`);
            return null;
        }

        const [account] = await db
            .select()
            .from(crmAccounts)
            .where(eq(crmAccounts.integrationId, integration.id))
            .limit(1);

        if (!account) {
            logger.warn(`No Kommo account found for integration ${integration.id}`);
            return null;
        }

        const accessToken = decrypt(account.accessToken);
        if (!accessToken) {
            logger.error(`Failed to decrypt Kommo access token for integration ${integration.id}`);
            return null;
        }

        return {
            domain: account.domain,
            accessToken,
            integrationId: integration.id,
            config: integration.config as Record<string, any> | null,
        };
    } catch (error) {
        logger.error('Error getting Kommo credentials:', error);
        return null;
    }
}

// ============================================
// GET PIPELINE MAPPING
// ============================================

/**
 * Get pipeline ID for a board from crmMappings, or use default.
 */
async function getPipelineId(integrationId: string, boardId?: string): Promise<number> {
    if (!boardId) return DEFAULT_KOMMO_PIPELINE_ID;

    try {
        const [mapping] = await db
            .select()
            .from(crmMappings)
            .where(
                and(
                    eq(crmMappings.integrationId, integrationId),
                    eq(crmMappings.boardId, boardId)
                )
            )
            .limit(1);

        if (mapping?.pipelineId) {
            return parseInt(mapping.pipelineId, 10) || DEFAULT_KOMMO_PIPELINE_ID;
        }
    } catch (error) {
        logger.warn('Error getting pipeline mapping, using default:', error);
    }

    return DEFAULT_KOMMO_PIPELINE_ID;
}

// ============================================
// KOMMO API CALLS
// ============================================

/**
 * Extract the api_domain from a JWT token (without verification).
 */
export function getApiDomainFromToken(token: string): string | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payloadToken = parts[1] || '';
        const payload = JSON.parse(Buffer.from(payloadToken, 'base64url').toString('utf-8'));
        return payload.api_domain || null;
    } catch {
        return null;
    }
}

/**
 * Make an authenticated request to the Kommo API v4.
 * Tries the subdomain URL first, then falls back to the JWT api_domain.
 */
async function kommoApiRequest(
    credentials: KommoCredentials,
    method: string,
    path: string,
    body?: any
): Promise<any> {
    // Build the primary URL from the stored domain
    let baseUrl = credentials.domain;
    if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`;
    }
    baseUrl = baseUrl.replace(/\/$/, '');

    // Extract api_domain from JWT for fallback
    const apiDomain = getApiDomainFromToken(credentials.accessToken);

    // Try subdomain URL first, then api_domain
    const urlsToTry = [
        `${baseUrl}/api/v4${path}`,
    ];
    if (apiDomain) {
        urlsToTry.push(`https://${apiDomain}/api/v4${path}`);
    }

    let lastError: Error | null = null;

    for (const url of urlsToTry) {
        try {
            logger.info(`API ${method} ${path}`, { url: url.replace(/api\/v4.*/, 'api/v4/...') });

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${credentials.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (response.status === 401 && urlsToTry.indexOf(url) < urlsToTry.length - 1) {
                logger.warn(`Got 401 from ${url}, trying next URL...`);
                lastError = new Error(`Kommo API 401 from ${url}`);
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unable to read error body');
                throw new Error(`Kommo API ${response.status} ${response.statusText}: ${errorText}`);
            }

            // Some endpoints return empty body (e.g., 204 No Content)
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                return await response.json();
            }
            return null;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (urlsToTry.indexOf(url) < urlsToTry.length - 1) {
                logger.warn(`Error with ${url}, trying next URL...`, lastError.message);
                continue;
            }
        }
    }

    throw lastError || new Error('All Kommo API URLs failed');
}

// ============================================
// PUSH LEAD TO KOMMO
// ============================================

/**
 * Push a MasterIA lead to Kommo CRM using the Complex Lead API.
 * Creates both the lead and contact in one call.
 * Fire-and-forget — never blocks the caller.
 */
export async function pushLeadToKommo(
    companyId: string,
    data: KommoLeadData
): Promise<KommoApiResponse> {
    const startTime = Date.now();

    try {
        // 1. Get credentials
        const credentials = await getKommoCredentials(companyId);
        if (!credentials) {
            return { success: false, error: 'No Kommo integration configured' };
        }

        // 2. Check if lead already synced (has externalId for kommo)
        const lead = await db.query.kanbanLeads.findFirst({
            where: eq(kanbanLeads.id, data.leadId),
        });

        if (lead?.externalId && lead?.externalProvider === 'kommo') {
            logger.info(`Lead ${data.leadId} already synced to Kommo (${lead.externalId}), skipping`);
            return { success: true, kommoLeadId: parseInt(lead.externalId, 10) };
        }

        // 3. Get pipeline ID (override with config if exists)
        let pipelineId = await getPipelineId(credentials.integrationId, lead?.boardId || undefined);

        // Allow user config to override default/mapped pipeline
        if (credentials.config?.defaultPipelineId) {
            pipelineId = parseInt(credentials.config.defaultPipelineId, 10);
        }

        // Fetch full contact to expose all custom fields and address details
        const contact = await db.query.contacts.findFirst({
            where: eq(contacts.id, data.contactId)
        });

        // 4. Build Custom Fields based on fieldMapping
        const customFields: any[] = [];
        const mapping = credentials.config?.fieldMapping as Record<string, string> | undefined;

        if (mapping) {
            // Helper to get nested value like 'contact.customFields.cnpj'
            const getValueFromPath = (path: string, obj: any) => {
                return path.split('.').reduce((o, k) => (o || {})[k], obj);
            };

            // Full exposure to integrations
            const lookupContext = {
                contact: contact || {},
                lead: lead || {
                    value: data.value,
                    title: data.title,
                    source: data.source,
                    notes: data.notes
                },
                metadata: data.metadata || {},
            };

            for (const [masteriaPath, kommoFieldId] of Object.entries(mapping)) {
                if (!kommoFieldId) continue;

                const val = getValueFromPath(masteriaPath, lookupContext);

                if (val !== undefined && val !== null && val !== '') {
                    customFields.push({
                        field_id: parseInt(kommoFieldId, 10),
                        values: [{ value: String(val) }]
                    });
                }
            }
        }

        // 5. Build Kommo payload using Complex Lead creation
        // POST /api/v4/leads/complex — creates lead + contact + note in one call
        const kommoPayload = [
            {
                name: data.title || `Lead — ${data.contactName}`,
                pipeline_id: pipelineId,
                ...(credentials.config?.defaultStatusId ? { status_id: parseInt(credentials.config.defaultStatusId, 10) } : {}),
                ...(data.value ? { price: data.value } : {}),
                ...(customFields.length > 0 ? { custom_fields_values: customFields } : {}),
                _embedded: {
                    contacts: [
                        {
                            first_name: data.contactName,
                            custom_fields_values: [
                                ...(data.contactPhone ? [{
                                    field_code: 'PHONE',
                                    values: [{ value: data.contactPhone, enum_code: 'MOB' }],
                                }] : []),
                                ...(data.contactEmail ? [{
                                    field_code: 'EMAIL',
                                    values: [{ value: data.contactEmail, enum_code: 'WORK' }],
                                }] : []),
                            ].filter(f => f.values.length > 0),
                        },
                    ],
                },
                // Add tagging for identification
                _embedded_tags: [
                    { name: 'MasterIA' },
                    ...(data.source ? [{ name: `MasterIA: ${data.source}` }] : []),
                ],
            },
        ];

        // 5. Call Kommo API
        const result = await kommoApiRequest(credentials, 'POST', '/leads/complex', kommoPayload);

        // 6. Extract IDs from response
        const kommoLeadId = result?.[0]?.id || result?._embedded?.leads?.[0]?.id;
        const kommoContactId = result?.[0]?._embedded?.contacts?.[0]?.id || result?._embedded?.contacts?.[0]?.id;

        if (!kommoLeadId) {
            throw new Error('Kommo API did not return a lead ID');
        }

        // 7. Update MasterIA lead with Kommo external ID
        await db
            .update(kanbanLeads)
            .set({
                externalId: String(kommoLeadId),
                externalProvider: 'kommo',
            })
            .where(eq(kanbanLeads.id, data.leadId));

        // 8. Add note with form data if available
        if (data.notes || data.leadId) {
            try {
                // Prefix with MasterIA ID for easy lookup/reference
                const noteText = `[ID MasterIA: ${data.leadId}]\n${data.notes || ''}`.trim();

                await kommoApiRequest(credentials, 'POST', `/leads/${kommoLeadId}/notes`, [
                    {
                        note_type: 'common',
                        params: {
                            text: noteText,
                        },
                    },
                ]);
                logger.info('Note added to Kommo lead', { kommoLeadId });

            } catch (noteError) {
                logger.warn('Failed to add note to Kommo lead (non-blocking):', noteError);
            }
        }

        // 9. Log success
        await logSync(credentials.integrationId, 'push', 'SUCCESS', {
            masteriaLeadId: data.leadId,
            kommoLeadId,
            kommoContactId,
            source: data.source,
            processingTime: Date.now() - startTime,
        });

        logger.info(`✅ Lead synced to Kommo`, {
            masteriaLeadId: data.leadId,
            kommoLeadId,
            kommoContactId,
            source: data.source,
            processingTime: `${Date.now() - startTime}ms`,
        });

        return { success: true, kommoLeadId, kommoContactId };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Log failure
        try {
            const credentials = await getKommoCredentials(companyId);
            if (credentials) {
                await logSync(credentials.integrationId, 'push', 'FAILED', {
                    masteriaLeadId: data.leadId,
                    source: data.source,
                }, errorMessage);
            }
        } catch (logError) {
            // Ignore log errors
        }

        logger.error(`Failed to sync lead ${data.leadId} to Kommo:`, error);
        return { success: false, error: errorMessage };
    }
}

// ============================================
// UPDATE LEAD STAGE IN KOMMO
// ============================================

/**
 * Update a lead's stage/status in Kommo when it moves in MasterIA Kanban.
 * Fire-and-forget — never blocks the caller.
 */
export async function updateLeadStageInKommo(
    companyId: string,
    kommoLeadId: string,
    newStageId: string,
    boardId: string
): Promise<KommoApiResponse> {
    try {
        // 1. Get credentials
        const credentials = await getKommoCredentials(companyId);
        if (!credentials) {
            return { success: false, error: 'No Kommo integration configured' };
        }

        // 2. Get stage mapping
        const [mapping] = await db
            .select()
            .from(crmMappings)
            .where(
                and(
                    eq(crmMappings.integrationId, credentials.integrationId),
                    eq(crmMappings.boardId, boardId)
                )
            )
            .limit(1);

        if (!mapping) {
            logger.warn(`No stage mapping found for board ${boardId}, skipping Kommo stage update`);
            return { success: false, error: 'No stage mapping configured' };
        }

        // stageMap: { masteria_stage_id: kommo_status_id }
        const stageMap = mapping.stageMap as Record<string, string>;
        const kommoStatusId = stageMap?.[newStageId];

        if (!kommoStatusId) {
            logger.warn(`No Kommo status mapped for MasterIA stage ${newStageId}`);
            return { success: false, error: `No Kommo status mapped for stage ${newStageId}` };
        }

        // 3. Update lead in Kommo
        await kommoApiRequest(credentials, 'PATCH', `/leads/${kommoLeadId}`, {
            status_id: parseInt(kommoStatusId, 10),
        });

        // 4. Log success
        await logSync(credentials.integrationId, 'stage_update', 'SUCCESS', {
            kommoLeadId,
            newStageId,
            kommoStatusId,
        });

        logger.info(`✅ Lead stage updated in Kommo`, { kommoLeadId, kommoStatusId });

        return { success: true, kommoLeadId: parseInt(kommoLeadId, 10) };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to update stage for Kommo lead ${kommoLeadId}:`, error);
        return { success: false, error: errorMessage };
    }
}

// ============================================
// SYNC LOG
// ============================================

async function logSync(
    integrationId: string,
    type: string,
    status: string,
    payload: Record<string, any>,
    error?: string
): Promise<void> {
    try {
        await db.insert(crmSyncLogs).values({
            integrationId,
            type,
            status,
            payload,
            error: error || null,
        });
    } catch (logError) {
        logger.error('Failed to write sync log:', logError);
    }
}
