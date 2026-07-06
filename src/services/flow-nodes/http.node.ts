import { FlowStep } from '@/services/flow-triggers.service';
import { ExecutionContext, NodeResult, NodeHandler } from './types';
import { interpolateTemplate } from '@/lib/flow-engine';
import { logger } from '@/lib/logger';

export class HttpNodeHandler implements NodeHandler {
    async execute(step: FlowStep, ctx: ExecutionContext, allSteps: FlowStep[]): Promise<NodeResult> {
        switch (step.type) {
        case 'http_request': {
            const rawUrl = step.data.url;
            if (!rawUrl) return { message: 'HTTP: no URL' };

            const method = step.data.method || 'GET';
            const headers: Record<string, string> = {};
            const responseVarName = step.data.response_var || 'http_response';

            // 1. Custom headers from UI config
            if (Array.isArray(step.data.headers)) {
                for (const h of step.data.headers) {
                    if (h.key && h.value) {
                        headers[h.key] = await interpolateTemplate(h.value, ctx);
                    }
                }
            }

            // 2. Auth — bearer, api_key, basic
            const authType = step.data.auth_type || 'none';
            if (authType === 'bearer' && step.data.auth_token) {
                headers['Authorization'] = `Bearer ${step.data.auth_token}`;
            } else if (authType === 'api_key' && step.data.auth_header_name && step.data.auth_token) {
                headers[step.data.auth_header_name] = step.data.auth_token;
            } else if (authType === 'basic' && step.data.auth_user) {
                const credentials = Buffer.from(`${step.data.auth_user}:${step.data.auth_pass || ''}`).toString('base64');
                headers['Authorization'] = `Basic ${credentials}`;
            }

            // 3. URL interpolation + query params
            let finalUrl = await interpolateTemplate(rawUrl, ctx);
            if (Array.isArray(step.data.query_params) && step.data.query_params.length > 0) {
                const params = new URLSearchParams();
                for (const p of step.data.query_params) {
                    if (p.key) {
                        params.append(p.key, await interpolateTemplate(p.value || '', ctx));
                    }
                }
                const separator = finalUrl.includes('?') ? '&' : '?';
                finalUrl += separator + params.toString();
            }

            // 4. Body — based on body_type config
            const fetchOpts: RequestInit = { method, headers };
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
                const bodyType = step.data.body_type || 'json';

                if (bodyType === 'json' && step.data.body_json) {
                    // Custom JSON body from UI
                    const interpolatedJson = await interpolateTemplate(step.data.body_json, ctx);
                    try {
                        // Validate JSON then stringify (allows re-formatting)
                        const parsed = JSON.parse(interpolatedJson);
                        fetchOpts.body = JSON.stringify(parsed);
                    } catch {
                        // If JSON parse fails, send as-is
                        fetchOpts.body = interpolatedJson;
                    }
                    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
                } else if (bodyType === 'form' && Array.isArray(step.data.body_form)) {
                    // Form data
                    const formParams = new URLSearchParams();
                    for (const f of step.data.body_form) {
                        if (f.key) {
                            formParams.append(f.key, await interpolateTemplate(f.value || '', ctx));
                        }
                    }
                    fetchOpts.body = formParams.toString();
                    if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
                } else if (bodyType === 'text' && step.data.body_text) {
                    fetchOpts.body = await interpolateTemplate(step.data.body_text, ctx);
                    if (!headers['Content-Type']) headers['Content-Type'] = 'text/plain';
                } else if (bodyType !== 'none') {
                    // Fallback: auto-body with context variables (legacy behavior)
                    fetchOpts.body = JSON.stringify({
                        ...ctx.variables,
                        contact: { name: ctx.contactName, phone: ctx.contactPhone, email: ctx.contactEmail },
                    });
                    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
                }
            }

            try {
                const response = await fetch(finalUrl, fetchOpts);
                let result: any;
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    result = await response.text();
                }
                return {
                    newVars: { [responseVarName]: result, http_status: response.status },
                    message: `HTTP ${method} ${response.status}`,
                };
            } catch (e) {
                if (step.data.continue_on_error) {
                    return {
                        newVars: { [responseVarName]: null, http_status: 0, http_error: String(e) },
                        message: `HTTP error (continued): ${e}`,
                    };
                }
                return { newVars: { http_error: String(e) }, message: `HTTP error: ${e}` };
            }
        }

        // ---- Code Execution ----
            default:
                return { message: 'Unknown http node type' };
        }
    }
}
