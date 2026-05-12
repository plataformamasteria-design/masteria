import { interpolateText } from "../utils/shared.ts";

export async function handleHttpRequest(config: any, context: any, vars: any, nodeId: string) {
    const {
        method = "GET", url, auth_type = "none", auth_config = {},
        send_headers, headers = [], headers_json, headers_mode = "manual",
        send_query_params, query_params = [], query_params_json, query_params_mode = "manual",
        send_body, body_mode = "fields", body_fields = [], body_json
    } = config;

    if (!url) return { success: false, message: "URL não configurada" };

    const resolvedVars = vars || {};
    const interpolatedUrl = interpolateText(url, resolvedVars);

    const requestHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (send_headers) {
        if (headers_mode === "json" && headers_json) {
            try {
                const jsonHeaders = JSON.parse(interpolateText(headers_json, resolvedVars));
                Object.assign(requestHeaders, jsonHeaders);
            } catch (e) { console.error("Header JSON parse error:", e); }
        } else {
            headers.forEach((h: any) => {
                if (h.name) requestHeaders[h.name] = interpolateText(h.value, resolvedVars);
            });
        }
    }

    if (auth_type === "bearer" && auth_config.token) {
        requestHeaders["Authorization"] = `Bearer ${interpolateText(auth_config.token, resolvedVars)}`;
    } else if (auth_type === "basic" && auth_config.username) {
        const creds = btoa(`${interpolateText(auth_config.username, resolvedVars)}:${interpolateText(auth_config.password || "", resolvedVars)}`);
        requestHeaders["Authorization"] = `Basic ${creds}`;
    } else if (auth_type === "api_key" && auth_config.key) {
        const keyName = interpolateText(auth_config.header_name || "x-api-key", resolvedVars);
        const prefix = auth_config.prefix ? interpolateText(auth_config.prefix, resolvedVars) + " " : "";
        requestHeaders[keyName] = prefix + interpolateText(auth_config.key, resolvedVars);
    }

    let finalUrl = interpolatedUrl;
    if (send_query_params) {
        const urlObj = new URL(interpolatedUrl);
        if (query_params_mode === "json" && query_params_json) {
            try {
                const jsonParams = JSON.parse(interpolateText(query_params_json, resolvedVars));
                Object.entries(jsonParams).forEach(([k, v]) => urlObj.searchParams.set(k, String(v)));
            } catch (e) { console.error("Query param JSON parse error:", e); }
        } else {
            query_params.forEach((p: any) => {
                if (p.name) urlObj.searchParams.set(p.name, interpolateText(p.value, resolvedVars));
            });
        }
        finalUrl = urlObj.toString();
    }

    let requestBody: any = null;
    if (send_body && !["GET", "HEAD"].includes(method)) {
        if (body_mode === "raw" || body_mode === "json") {
            requestBody = interpolateText(body_json, resolvedVars);
        } else {
            const bodyObj: Record<string, any> = {};
            body_fields.forEach((f: any) => {
                if (f.name) bodyObj[f.name] = interpolateText(f.value, resolvedVars);
            });
            requestBody = JSON.stringify(bodyObj);
        }
    }

    try {
        const timeoutSec = config.timeout_seconds ?? 30;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

        const response = await fetch(finalUrl, { method, headers: requestHeaders, body: requestBody, signal: controller.signal });
        clearTimeout(timeoutId);

        const contentType = response.headers.get("content-type");
        let responseData: any = null;
        if (contentType?.includes("application/json")) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        if (context) {
            context[`node_${nodeId}_response`] = responseData;
            context[`node_${nodeId}_status`] = response.status;
        }
        return { success: response.ok, message: `HTTP ${response.status}` };
    } catch (e: any) {
        return { success: false, message: `Request failed: ${e.message}` };
    }
}
