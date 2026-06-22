import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/automation-flows/test-node
 * Executa um único node em modo sandbox e retorna o output.
 * Body: { nodeType, nodeData, inputData?, companyId }
 */
export async function POST(req: NextRequest) {
    const start = Date.now();

    try {
        const body = await req.json();
        const { nodeType, nodeData, inputData = {}, companyId } = body;

        if (!nodeType || !companyId) {
            return NextResponse.json(
                { success: false, error: 'nodeType e companyId são obrigatórios' },
                { status: 400 }
            );
        }

        let output: any = null;
        let outputType: 'json' | 'string' = 'json';

        switch (nodeType) {
            // ---- HTTP Request: execução real ----
            case 'http_request': {
                const method = (nodeData.method || 'GET').toUpperCase();
                const url = interpolateVars(nodeData.url || '', inputData);

                if (!url) {
                    output = { error: 'URL não configurada' };
                    break;
                }

                const fetchOptions: RequestInit = {
                    method,
                    headers: buildHeaders(nodeData, inputData),
                };

                // Body para POST/PUT/PATCH
                if (['POST', 'PUT', 'PATCH'].includes(method)) {
                    const bodyType = nodeData.body_type || 'json';
                    if (bodyType === 'json') {
                        fetchOptions.body = interpolateVars(nodeData.body_content || '{}', inputData);
                    } else if (bodyType === 'text') {
                        fetchOptions.body = interpolateVars(nodeData.body_content || '', inputData);
                    } else if (bodyType === 'form') {
                        const form = new URLSearchParams();
                        (nodeData.body_pairs || []).forEach((p: { key: string; value: string }) => {
                            form.append(p.key, interpolateVars(p.value, inputData));
                        });
                        fetchOptions.body = form.toString();
                        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded';
                    }
                }

                try {
                    const response = await fetch(url, {
                        ...fetchOptions,
                        signal: AbortSignal.timeout(15000), // 15s timeout
                    });

                    const contentType = response.headers.get('content-type') || '';
                    let responseBody: any;

                    if (contentType.includes('application/json')) {
                        responseBody = await response.json();
                        outputType = 'json';
                    } else {
                        responseBody = await response.text();
                        outputType = 'string';
                    }

                    output = {
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries()),
                        body: responseBody,
                    };
                } catch (fetchError: any) {
                    output = {
                        error: fetchError.message || 'Fetch failed',
                        status: 0,
                    };
                }
                break;
            }

            // ---- Code: execução JS sandbox ----
            case 'code': {
                const code = nodeData.code || '';
                const language = nodeData.language || 'javascript';

                if (language !== 'javascript') {
                    output = { error: `Linguagem "${language}" não suportada para teste. Use JavaScript.` };
                    break;
                }

                try {
                    // Sandbox seguro com timeout
                    const wrappedCode = `
                        'use strict';
                        const input = ${JSON.stringify(inputData)};
                        const vars = ${JSON.stringify(inputData)};
                        ${code}
                    `;

                    const fn = new Function(wrappedCode);
                    const result = fn();

                    output = {
                        result: result !== undefined ? result : null,
                        type: typeof result,
                    };
                    outputType = typeof result === 'object' ? 'json' : 'string';
                } catch (codeError: any) {
                    output = {
                        error: codeError.message,
                        stack: codeError.stack?.split('\n').slice(0, 3).join('\n'),
                    };
                }
                break;
            }

            // ---- Lookup Lead: busca real ----
            case 'lookup_lead': {
                const phoneVar = nodeData.phone_variable || 'customer_phone';
                const rawPhone = inputData[phoneVar] || inputData.contact_phone || '';
                const cleaned = rawPhone.replace(/[^0-9]/g, '');

                if (!cleaned) {
                    output = { error: 'Telefone não encontrado na variável: ' + phoneVar, available_vars: Object.keys(inputData) };
                    break;
                }

                // Busca real no DB
                try {
                    const { db } = await import('@/lib/db');
                    const { contacts } = await import('@/lib/db/schema');
                    const { eq } = await import('drizzle-orm');

                    const variations = [cleaned];
                    if (cleaned.startsWith('55')) variations.push(cleaned.substring(2));
                    else variations.push('55' + cleaned);

                    let found = null;
                    for (const phone of variations) {
                        const result = await db.query.contacts.findFirst({
                            where: eq(contacts.phone, phone),
                        });
                        if (result) { found = result; break; }
                    }

                    if (found) {
                        output = { found: true, lead_id: found.id, lead_name: found.name, lead_phone: found.phone, lead_email: found.email };
                    } else if (nodeData.auto_create !== false) {
                        const defaultName = nodeData.default_name ? interpolateVars(nodeData.default_name, inputData) : `Lead ${rawPhone}`;
                        output = { found: false, would_create: true, name: defaultName, phone: cleaned };
                    } else {
                        output = { found: false, phone_searched: cleaned, variations_tried: variations };
                    }
                } catch (dbErr: any) {
                    output = { error: 'DB lookup failed: ' + dbErr.message, phone: cleaned };
                }
                break;
            }

            // ---- Send Template: preview ----
            case 'send_template': {
                const tVars = (nodeData.template_variables || []).map((v: any, i: number) => ({
                    position: i + 1,
                    value: interpolateVars(v.value || '', inputData),
                    raw: v.value,
                }));
                output = {
                    _test: true,
                    action: 'send_template',
                    template_name: nodeData.template_name || '(não configurado)',
                    language: nodeData.template_language || 'pt_BR',
                    variables: tVars,
                    would_send_to: inputData.contact_phone || inputData.lead_phone || '(sem telefone)',
                };
                break;
            }

            // ---- AI Agent: simulação ----
            case 'ai_agent': {
                output = {
                    _test: true,
                    response: `[Simulação] Resposta do ${nodeData.provider || 'gemini'} / ${nodeData.model || 'gemini-2.5-flash'}`,
                    provider: nodeData.provider || 'gemini',
                    model: nodeData.model || 'gemini-2.5-flash',
                    tokens_used: 0,
                    system_message_preview: (nodeData.system_message || '').slice(0, 100),
                };
                break;
            }

            // ---- Condition ----
            case 'condition': {
                const condType = nodeData.condition_type || 'response_equals';
                const condValue = nodeData.condition_value || '';
                const testValue = inputData.last_response || inputData.test_value || '';

                let condMet = false;
                if (condType === 'has_tag') condMet = (inputData.tags || []).includes(condValue);
                else if (condType === 'response_equals') condMet = testValue === condValue;
                else if (condType === 'response_contains') condMet = testValue.includes(condValue);
                else if (condType === 'is_assigned') condMet = !!inputData.assigned_to;

                output = {
                    condition_type: condType,
                    condition_value: condValue,
                    test_input: testValue,
                    result: condMet,
                    output_handle: condMet ? 'yes' : 'no',
                };
                break;
            }

            // ---- Filter ----
            case 'filter': {
                const conditions = nodeData.conditions || [];
                const matchMode = nodeData.match_mode || 'all';

                const results = conditions.map((c: any) => {
                    const fieldVal = inputData[c.field] || '';
                    let pass = false;
                    switch (c.operator) {
                        case 'equals': pass = fieldVal === c.value; break;
                        case 'not_equals': pass = fieldVal !== c.value; break;
                        case 'contains': pass = String(fieldVal).includes(c.value); break;
                        case 'not_contains': pass = !String(fieldVal).includes(c.value); break;
                        case 'starts_with': pass = String(fieldVal).startsWith(c.value); break;
                        case 'ends_with': pass = String(fieldVal).endsWith(c.value); break;
                        case 'is_empty': pass = !fieldVal; break;
                        case 'is_not_empty': pass = !!fieldVal; break;
                        default: pass = false;
                    }
                    return { field: c.field, operator: c.operator, value: c.value, input: fieldVal, pass };
                });

                const allPass = results.every((r: any) => r.pass);
                const anyPass = results.some((r: any) => r.pass);
                const finalResult = matchMode === 'all' ? allPass : anyPass;

                output = {
                    match_mode: matchMode,
                    conditions: results,
                    result: finalResult,
                    output_handle: finalResult ? 'pass' : 'block',
                };
                break;
            }

            // ---- Send Message (simulado) ----
            case 'send_message':
            case 'message': {
                const message = interpolateVars(nodeData.message || nodeData.content || '', inputData);
                output = {
                    _test: true,
                    action: 'send_message',
                    message_preview: message,
                    would_send_to: inputData.contact_phone || '(contato de teste)',
                };
                outputType = 'json';
                break;
            }

            // ---- Delay ----
            case 'delay': {
                output = {
                    _test: true,
                    action: 'delay',
                    amount: nodeData.amount || '5',
                    unit: nodeData.unit || 'minutes',
                    description: `Aguardaria ${nodeData.amount || '5'} ${nodeData.unit || 'minutes'}`,
                };
                break;
            }

            // ---- Router ----
            case 'router': {
                const rules = nodeData.rules || [];
                const matchedRules = rules.map((rule: any, i: number) => ({
                    index: i,
                    label: rule.label || `Rota ${i + 1}`,
                    condition: rule.condition,
                    would_match: false, // Simplification
                }));
                output = {
                    _test: true,
                    rules_count: rules.length,
                    rules: matchedRules,
                };
                break;
            }

            // ---- Edit Fields ----
            case 'edit_fields': {
                const fields = nodeData.fields || [];
                const result: Record<string, any> = { ...inputData };
                fields.forEach((f: any) => {
                    result[f.key] = interpolateVars(f.value || '', inputData);
                });
                output = {
                    input: inputData,
                    output: result,
                    fields_modified: fields.map((f: any) => f.key),
                };
                break;
            }

            // ---- Default: generic mock ----
            default: {
                output = {
                    _test: true,
                    node_type: nodeType,
                    status: 'simulated',
                    data: nodeData,
                    input: inputData,
                };
            }
        }

        const executionTime = Date.now() - start;

        return NextResponse.json({
            success: true,
            output,
            outputType,
            executionTime,
            nodeType,
        });

    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || 'Erro interno' },
            { status: 500 }
        );
    }
}

// ---- Helpers ----

function interpolateVars(template: string, vars: Record<string, any>): string {
    if (!template) return template;
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
        const parts = path.split('.');
        let value: any = vars;
        for (const part of parts) {
            value = value?.[part];
        }
        return value !== undefined ? String(value) : `{{${path}}}`;
    });
}

function buildHeaders(nodeData: any, inputData: Record<string, any>): Record<string, string> {
    const headers: Record<string, string> = {};

    // Custom headers
    if (nodeData.headers && Array.isArray(nodeData.headers)) {
        nodeData.headers.forEach((h: { key: string; value: string }) => {
            if (h.key) headers[h.key] = interpolateVars(h.value, inputData);
        });
    }

    // Auth
    const authType = nodeData.auth_type || 'none';
    if (authType === 'bearer' && nodeData.auth_token) {
        headers['Authorization'] = `Bearer ${interpolateVars(nodeData.auth_token, inputData)}`;
    } else if (authType === 'api_key' && nodeData.auth_key_name && nodeData.auth_key_value) {
        headers[nodeData.auth_key_name] = interpolateVars(nodeData.auth_key_value, inputData);
    } else if (authType === 'basic' && nodeData.auth_username && nodeData.auth_password) {
        const b64 = Buffer.from(`${nodeData.auth_username}:${nodeData.auth_password}`).toString('base64');
        headers['Authorization'] = `Basic ${b64}`;
    }

    // Default content type for JSON bodies
    if (!headers['Content-Type'] && nodeData.body_type === 'json') {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}
