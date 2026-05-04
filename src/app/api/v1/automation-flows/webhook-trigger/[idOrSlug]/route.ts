import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { automationFlows } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { triggerFlow } from '@/lib/flow-engine';
import { redis } from '@/lib/redis';

/**
 * POST/GET /api/v1/automation-flows/webhook-trigger/[idOrSlug]
 * 
 * Receives external webhooks and triggers automation flows.
 * Searches by:
 *   1. Custom webhook_slug in trigger data
 *   2. Flow ID (backward compat)
 * 
 * Stores received data in Redis for the listen endpoint (test mode).
 */

// Redis key prefix for webhook events
const WEBHOOK_EVENT_PREFIX = 'webhook_event:';
const WEBHOOK_EVENT_TTL = 300; // 5 minutes

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ idOrSlug: string }> }
) {
    return handleWebhookTrigger(req, await params);
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ idOrSlug: string }> }
) {
    return handleWebhookTrigger(req, await params);
}

async function handleWebhookTrigger(
    req: NextRequest,
    params: { idOrSlug: string }
) {
    const { idOrSlug: slug } = params;
    const start = Date.now();

    try {
        // 1. Find flow by slug or flowId
        let flow: any = null;

        // First: try to find by webhook_slug in execution logic
        const allActiveFlows = await db.query.automationFlows.findMany({
            where: eq(automationFlows.isActive, true),
        });

        for (const f of allActiveFlows) {
            const logic = f.executionLogic as any;
            // executionLogic can be either an array of steps directly, or { steps: [...] }
            const steps = Array.isArray(logic) ? logic : logic?.steps;
            if (!steps?.length) continue;
            const trigger = steps.find((s: any) => s.type === 'trigger');
            if (trigger?.data?.webhook_slug === slug) {
                flow = f;
                break;
            }
        }

        // Fallback: try as flowId
        if (!flow) {
            flow = await db.query.automationFlows.findFirst({
                where: and(
                    eq(automationFlows.id, slug),
                    eq(automationFlows.isActive, true),
                ),
            });
        }

        if (!flow) {
            return NextResponse.json(
                { success: false, error: 'Webhook not found. Check your slug or flow ID.' },
                { status: 404 }
            );
        }

        // 2. Validate secret if configured
        const flowLogic = flow.executionLogic as any;
        const flowSteps = Array.isArray(flowLogic) ? flowLogic : flowLogic?.steps;
        const triggerStep = flowSteps?.find((s: any) => s.type === 'trigger');
        const webhookSecret = triggerStep?.data?.webhook_secret;

        if (webhookSecret) {
            const providedSecret = req.headers.get('X-Webhook-Secret')
                || req.headers.get('x-webhook-secret')
                || req.nextUrl.searchParams.get('secret');

            if (providedSecret !== webhookSecret) {
                return NextResponse.json(
                    { success: false, error: 'Invalid webhook secret' },
                    { status: 401 }
                );
            }
        }

        // 3. Extract data from request
        let body: any = {};
        const contentType = req.headers.get('content-type') || '';

        if (req.method !== 'GET') {
            if (contentType.includes('application/json')) {
                try { body = await req.json(); } catch { body = {}; }
            } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
                try {
                    const formData = await req.formData();
                    formData.forEach((value, key) => { body[key] = value; });
                } catch { body = {}; }
            } else {
                try {
                    const text = await req.text();
                    try { body = JSON.parse(text); } catch { body = { _raw: text }; }
                } catch { body = {}; }
            }
        }

        // Query parameters
        const query: Record<string, string> = {};
        req.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'secret') query[key] = value;
        });

        // Selected headers
        const headers: Record<string, string> = {};
        ['content-type', 'user-agent', 'x-request-id', 'x-correlation-id', 'origin', 'referer'].forEach(h => {
            const val = req.headers.get(h);
            if (val) headers[h] = val;
        });

        // 4. Build webhook event data
        const webhookData = {
            body,
            query,
            headers,
            method: req.method,
            timestamp: new Date().toISOString(),
            slug,
        };

        // 5. Store in Redis for listen endpoint (test mode)
        try {
            const redisKey = `${WEBHOOK_EVENT_PREFIX}${flow.id}`;
            const eventPayload = JSON.stringify({ data: webhookData, timestamp: Date.now() });
            await redis.set(redisKey, eventPayload, 'EX', WEBHOOK_EVENT_TTL);
            console.log(`[webhook-trigger] Stored event in Redis: ${redisKey}`);
        } catch (redisErr) {
            console.error('[webhook-trigger] Redis store error (non-fatal):', redisErr);
        }

        // 6. Build initial variables
        const initialVars: Record<string, any> = {
            webhook_body: body,
            webhook_query: query,
            webhook_headers: headers,
            webhook_method: req.method,
            webhook_timestamp: webhookData.timestamp,
            webhook_slug: slug,
            // Flatten body fields
            ...flattenObject(body, ''),
            // Common patterns
            ...(body.customer_name || body.name ? { contact_name: body.customer_name || body.name } : {}),
            ...(body.customer_phone || body.phone || body.whatsapp || body.telefone ? { contact_phone: body.customer_phone || body.phone || body.whatsapp || body.telefone } : {}),
            ...(body.customer_email || body.email ? { contact_email: body.customer_email || body.email } : {}),
            ...(body.amount ? { amount: body.amount } : {}),
            ...(body.value ? { value: body.value } : {}),
            ...(body.status ? { status: body.status } : {}),
            ...(body.event || body.event_type ? { event_type: body.event || body.event_type } : {}),
        };

        // 7. Determine contactId — must be a valid UUID from contacts table or null
        // Store phone/email in initialVars for lookup_lead node to resolve
        const contactPhone = initialVars.contact_phone || '';
        const contactEmail = initialVars.contact_email || '';
        // contactId is null — the lookup_lead node in the flow will find/create the real contact
        let contactId: string | null = null;

        // 8. Trigger the flow
        const result = await triggerFlow(
            flow.id,
            flow.companyId,
            contactId as any,
            initialVars
        );

        return NextResponse.json({
            success: true,
            triggered: true,
            flowId: flow.id,
            flowName: flow.name,
            slug,
            executionTime: Date.now() - start,
            receivedFields: Object.keys(body),
            ...(result ? { executionId: result } : {}),
        });

    } catch (error: any) {
        console.error('[webhook-trigger] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal error' },
            { status: 500 }
        );
    }
}

function flattenObject(obj: any, prefix: string): Record<string, any> {
    const result: Record<string, any> = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return result;
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, fullKey));
        } else {
            result[fullKey] = value;
        }
    }
    return result;
}
