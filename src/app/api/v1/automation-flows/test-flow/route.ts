import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/db';
import { contacts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/v1/automation-flows/test-flow
 * Executa o fluxo completo em modo dry-run (sem envio real de mensagens).
 * Body: { steps: FlowStep[], companyId, initialVars? }
 */

interface FlowStep {
    id: string;
    type: string;
    data: any;
    nextSteps: string[];
    connections: { target: string; sourceHandle: string | null }[];
}

interface NodeTestOutput {
    nodeId: string;
    nodeType: string;
    nodeLabel: string;
    output: any;
    outputType: 'json' | 'string';
    status: 'ok' | 'error' | 'skip';
    executionTime: number;
    message?: string;
}

export async function POST(req: NextRequest) {
    const totalStart = Date.now();

    try {
        const body = await req.json();
        const { steps, companyId, initialVars = {} }: {
            steps: FlowStep[];
            companyId: string;
            initialVars: Record<string, any>;
        } = body;

        if (!steps?.length || !companyId) {
            return NextResponse.json(
                { success: false, error: 'steps e companyId são obrigatórios' },
                { status: 400 }
            );
        }

        // Build step map
        const stepMap = new Map<string, FlowStep>();
        steps.forEach(s => stepMap.set(s.id, s));

        // Find trigger node
        const triggerStep = steps.find(s => s.type === 'trigger');
        if (!triggerStep) {
            return NextResponse.json(
                { success: false, error: 'Nenhum nó Trigger encontrado no fluxo' },
                { status: 400 }
            );
        }

        // BFS execution
        const nodeOutputs: NodeTestOutput[] = [];

        // Se initialVars contém dados do webhook, flatten e usar como base
        const webhookBody = initialVars.webhook_body || initialVars.body || null;
        const flatWebhook = webhookBody ? flattenObject(webhookBody, '') : {};

        const vars: Record<string, any> = {
            contact_name: 'Contato de Teste',
            contact_phone: '+5511999999999',
            contact_email: 'teste@email.com',
            last_response: 'Olá, preciso de ajuda',
            ...flatWebhook,
            ...initialVars,
        };

        const queue: string[] = [triggerStep.id];
        const visited = new Set<string>();
        const maxNodes = 50; // Safety limit
        let processedCount = 0;

        while (queue.length > 0 && processedCount < maxNodes) {
            const nodeId = queue.shift()!;
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);
            processedCount++;

            const step = stepMap.get(nodeId);
            if (!step) continue;

            const nodeStart = Date.now();
            let nodeOutput: any = {};
            let nodeStatus: 'ok' | 'error' | 'skip' = 'ok';
            let outputType: 'json' | 'string' = 'json';
            let message = '';
            let selectedHandle: string | undefined;

            try {
                // Execute node in test mode
                const result = await executeNodeTest(step, vars);
                nodeOutput = result.output;
                outputType = result.outputType;
                message = result.message || '';
                selectedHandle = result.sourceHandle;

                // Merge new vars
                if (result.newVars) {
                    Object.assign(vars, result.newVars);
                }

                // Store node output as variable for downstream nodes
                const nodeLabel = step.data.label || step.type;
                vars[`${nodeLabel}`] = nodeOutput;
                vars[`node_${step.id}`] = nodeOutput;

                // Handle pause/stop/delay
                if (result.action === 'stop') {
                    nodeStatus = 'ok';
                    message = 'Fluxo parado aqui';
                }
                if (result.action === 'pause') {
                    nodeStatus = 'ok';
                    message = message || 'Node aguardaria resposta';
                }

            } catch (err: any) {
                nodeStatus = 'error';
                nodeOutput = { error: err.message };
                message = err.message;
            }

            nodeOutputs.push({
                nodeId: step.id,
                nodeType: step.type,
                nodeLabel: step.data.label || step.type,
                output: nodeOutput,
                outputType,
                status: nodeStatus,
                executionTime: Date.now() - nodeStart,
                message,
            });

            // Resolve next nodes
            if (nodeStatus !== 'error') {
                if (selectedHandle) {
                    // Follow specific handle
                    const conn = step.connections.find(c => c.sourceHandle === selectedHandle);
                    if (conn) queue.push(conn.target);
                } else {
                    // Follow all connections
                    step.connections.forEach(c => queue.push(c.target));
                    // Fallback to nextSteps
                    if (step.connections.length === 0) {
                        step.nextSteps.forEach(t => queue.push(t));
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            nodeOutputs,
            totalTime: Date.now() - totalStart,
            nodesProcessed: processedCount,
            variables: vars,
        });

    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro interno' },
            { status: 500 }
        );
    }
}

// ---- Test-mode node executor ----

interface TestResult {
    output: any;
    outputType: 'json' | 'string';
    action?: 'continue' | 'pause' | 'delay' | 'stop';
    sourceHandle?: string;
    newVars?: Record<string, any>;
    message?: string;
}

async function executeNodeTest(step: FlowStep, vars: Record<string, any>): Promise<TestResult> {
    const d = step.data;

    switch (step.type) {
        case 'trigger': {
            // Se temos dados reais do webhook via initialVars, usá-los
            const hasWebhookData = vars.webhook_body || vars.body;
            return {
                output: hasWebhookData
                    ? { event: d.trigger_type || 'webhook_external', status: 'triggered', data: hasWebhookData, _real_data: true }
                    : { event: d.trigger_type || 'new_message', status: 'triggered' },
                outputType: 'json',
                message: hasWebhookData ? 'Webhook recebido com dados reais' : 'Trigger ativado (simulado)',
            };
        }

        case 'send_message':
        case 'message':
            return {
                output: {
                    action: 'send_message',
                    message: interpolate(d.message || d.content || '', vars),
                    to: vars.contact_phone,
                },
                outputType: 'json',
                message: 'Mensagem simulada',
            };

        case 'send_image':
        case 'send_audio':
        case 'send_video':
        case 'send_document':
            return {
                output: {
                    action: step.type,
                    url: d.file_url || d.url || '',
                    caption: interpolate(d.caption || '', vars),
                },
                outputType: 'json',
                message: `${step.type} simulado`,
            };

        case 'condition': {
            const condType = d.condition_type || 'response_equals';
            const condValue = d.condition_value || '';
            let condMet = false;

            if (condType === 'has_tag') condMet = (vars.tags || []).includes(condValue);
            else if (condType === 'response_equals') condMet = vars.last_response === condValue;
            else if (condType === 'response_contains') condMet = (vars.last_response || '').includes(condValue);
            else if (condType === 'is_assigned') condMet = !!vars.assigned_to;

            return {
                output: { condition: condType, value: condValue, result: condMet },
                outputType: 'json',
                sourceHandle: condMet ? 'yes' : 'no',
                message: `Condição: ${condMet ? 'SIM' : 'NÃO'}`,
            };
        }

        case 'filter': {
            const conditions = d.conditions || [];
            const matchMode = d.match_mode || 'all';
            const results = conditions.map((c: any) => {
                const val = vars[c.field] || '';
                let pass = false;
                switch (c.operator) {
                    case 'equals': pass = val === c.value; break;
                    case 'not_equals': pass = val !== c.value; break;
                    case 'contains': pass = String(val).includes(c.value); break;
                    default: pass = false;
                }
                return { ...c, input: val, pass };
            });
            const final = matchMode === 'all'
                ? results.every((r: any) => r.pass)
                : results.some((r: any) => r.pass);
            return {
                output: { match_mode: matchMode, conditions: results, result: final },
                outputType: 'json',
                sourceHandle: final ? 'pass' : 'block',
                message: `Filtro: ${final ? 'PASS' : 'BLOCK'}`,
            };
        }

        case 'delay':
            return {
                output: { delay: `${d.amount || 5} ${d.unit || 'minutes'}` },
                outputType: 'json',
                message: `Delay: ${d.amount || 5} ${d.unit || 'minutes'}`,
            };

        case 'http_request': {
            const method = (d.method || 'GET').toUpperCase();
            const url = interpolate(d.url || '', vars);
            if (!url) return { output: { error: 'URL vazia' }, outputType: 'json', message: 'URL não configurada' };

            try {
                const headers: Record<string, string> = {};
                (d.headers || []).forEach((h: any) => { if (h.key) headers[h.key] = interpolate(h.value, vars); });
                if (d.auth_type === 'bearer' && d.auth_token) headers['Authorization'] = `Bearer ${d.auth_token}`;

                const opts: RequestInit = { method, headers, signal: AbortSignal.timeout(15000) };
                if (['POST', 'PUT', 'PATCH'].includes(method) && d.body_content) {
                    opts.body = interpolate(d.body_content, vars);
                    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
                }

                const res = await fetch(url, opts);
                const ct = res.headers.get('content-type') || '';
                const body = ct.includes('json') ? await res.json() : await res.text();

                return {
                    output: { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), body },
                    outputType: ct.includes('json') ? 'json' : 'string',
                    newVars: { [d.response_var || 'response']: body },
                    message: `HTTP ${res.status} ${res.statusText}`,
                };
            } catch (e: any) {
                return { output: { error: e.message }, outputType: 'json', message: e.message };
            }
        }

        case 'code': {
            try {
                const code = d.code || '';
                const fn = new Function('input', 'vars', `'use strict'; ${code}`);
                const result = fn(vars, vars);
                return {
                    output: { result },
                    outputType: typeof result === 'object' ? 'json' : 'string',
                    newVars: typeof result === 'object' ? result : { code_result: result },
                    message: 'Código executado',
                };
            } catch (e: any) {
                return { output: { error: e.message }, outputType: 'json', message: e.message };
            }
        }

        case 'edit_fields': {
            const fields = d.fields || [];
            const result: Record<string, any> = {};
            fields.forEach((f: any) => {
                result[f.key] = interpolate(f.value || '', vars);
            });
            return {
                output: result,
                outputType: 'json',
                newVars: result,
                message: `${fields.length} campos editados`,
            };
        }

        case 'lookup_lead': {
            const phoneVar = d.phone_variable || 'customer_phone';
            const rawPhone = vars[phoneVar] || vars.contact_phone || '';
            const cleaned = rawPhone.replace(/[^0-9]/g, '');

            if (!cleaned) {
                return {
                    output: { error: 'Telefone não encontrado na variável: ' + phoneVar, available_vars: Object.keys(vars) },
                    outputType: 'json',
                    sourceHandle: 'not_found',
                    message: 'Lookup: telefone vazio',
                };
            }

            // Gerar variações do telefone
            const variations = [cleaned];
            if (cleaned.startsWith('55')) {
                variations.push(cleaned.substring(2));
            } else {
                variations.push('55' + cleaned);
            }

            // Busca real no DB
            let foundContact = null;
            try {
                for (const phone of variations) {
                    const result = await db.query.contacts.findFirst({
                        where: and(
                            eq(contacts.phone, phone),
                        )
                    });
                    if (result) { foundContact = result; break; }
                }
            } catch (e: any) {
                console.warn('[test-flow] DB lookup failed:', e.message);
            }

            if (foundContact) {
                return {
                    output: { found: true, lead_id: foundContact.id, lead_name: foundContact.name, lead_phone: foundContact.phone, lead_email: foundContact.email },
                    outputType: 'json',
                    sourceHandle: 'found',
                    newVars: { lead_id: foundContact.id, lead_name: foundContact.name, lead_phone: foundContact.phone, lead_found: true, contact_phone: foundContact.phone },
                    message: `Lead encontrado: ${foundContact.name}`,
                };
            }

            if (d.auto_create !== false) {
                const defaultName = d.default_name ? interpolate(d.default_name, vars) : `Lead ${rawPhone}`;
                return {
                    output: { found: false, would_create: true, name: defaultName, phone: cleaned, auto_create: true },
                    outputType: 'json',
                    sourceHandle: 'found',
                    newVars: { lead_name: defaultName, lead_phone: cleaned, lead_found: false, lead_created: true, contact_phone: cleaned },
                    message: `Lead não encontrado — seria criado: ${defaultName}`,
                };
            }

            return {
                output: { found: false, phone_searched: cleaned, variations_tried: variations },
                outputType: 'json',
                sourceHandle: 'not_found',
                message: 'Lead não encontrado',
            };
        }

        case 'send_template': {
            const templateName = d.template_name || '';
            const templateLang = d.template_language || 'pt_BR';
            const templateVars = (d.template_variables || []).map((v: any, i: number) => ({
                position: i + 1,
                value: interpolate(v.value || '', vars),
                raw: v.value,
            }));

            return {
                output: {
                    _test: true,
                    action: 'send_template',
                    template_name: templateName,
                    language: templateLang,
                    variables: templateVars,
                    would_send_to: vars.contact_phone || vars.lead_phone || '(sem telefone)',
                },
                outputType: 'json',
                message: templateName ? `Template "${templateName}" seria enviado` : 'Template não configurado',
            };
        }

        case 'ai_agent':
        case 'ai': {
            // Chamada REAL ao Gemini para validar prompt
            const systemPrompt = interpolate(d.system_message || d.description || d.systemPrompt || '', vars);
            const apiKey = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.google_api_key_agents1 || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

            if (!apiKey) {
                return {
                    output: { error: 'GEMINI_API_KEY não configurada' },
                    outputType: 'json',
                    message: 'Sem API key do Gemini',
                };
            }

            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const modelName = d.model || 'gemini-2.5-flash';
                const temperature = d.temperature ?? 0.7;
                const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature } });

                // Montar input composto
                const inputParts: string[] = [];
                if (d.include_lead_message !== false) {
                    const msg = vars.last_response || vars.message_text || 'Olá, preciso de ajuda';
                    inputParts.push(`[Mensagem do Lead]: ${msg}`);
                }
                if (d.include_webhook_vars && d.webhook_var_keys?.length) {
                    const wData = d.webhook_var_keys.map((k: string) => vars[k] !== undefined ? `${k}: ${vars[k]}` : null).filter(Boolean);
                    if (wData.length) inputParts.push(`[Dados do Webhook]:\n${wData.join('\n')}`);
                }

                const userInput = inputParts.join('\n\n') || 'Olá, preciso de ajuda';
                const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${userInput}` : userInput;

                const result = await model.generateContent(fullPrompt);
                const responseText = result.response?.text()?.trim() || '';

                return {
                    output: {
                        response: responseText,
                        provider: d.provider || 'gemini',
                        model: modelName,
                        tokens_used: result.response?.usageMetadata?.totalTokenCount || 0,
                        system_message_preview: systemPrompt.slice(0, 200),
                        dialogue_mode: !!d.dialogue_mode,
                        ...(d.dialogue_mode ? { max_turns: d.max_turns || 10, completion_condition: d.completion_condition || '' } : {}),
                    },
                    outputType: 'json',
                    sourceHandle: 'completed',
                    newVars: { last_ai_response: responseText },
                    message: `IA respondeu (${modelName}): ${responseText.slice(0, 80)}...`,
                    ...(d.dialogue_mode ? { action: 'pause' as const } : {}),
                };
            } catch (aiErr: any) {
                return {
                    output: { error: aiErr.message, provider: d.provider, model: d.model },
                    outputType: 'json',
                    message: `Erro IA: ${aiErr.message}`,
                };
            }
        }

        case 'action':
            return {
                output: { action: d.actionType, value: d.tag_name || d.assign_to || '' },
                outputType: 'json',
                message: `Ação: ${d.actionType}`,
            };

        case 'stop_bot':
        case 'bot_toggle':
            return {
                output: { action: step.type, status: 'done' },
                outputType: 'json',
                action: step.type === 'stop_bot' ? 'stop' : 'continue',
                message: step.type === 'stop_bot' ? 'Automação parada' : `Bot ${d.action}`,
            };

        case 'ask_question':
        case 'capture_info':
        case 'wait_response':
            return {
                output: { action: step.type, status: 'would_pause' },
                outputType: 'json',
                action: 'pause',
                message: 'Aguardaria resposta do contato',
            };

        default:
            return {
                output: { type: step.type, data: d, simulated: true },
                outputType: 'json',
                message: `Node ${step.type} simulado`,
            };
    }
}

function interpolate(template: string, vars: Record<string, any>): string {
    if (!template) return template;
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
        const parts = path.split('.');
        let value: any = vars;
        for (const part of parts) value = value?.[part];
        return value !== undefined ? String(value) : `{{${path}}}`;
    });
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
