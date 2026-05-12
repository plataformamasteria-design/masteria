export async function checkBotStatus(supabase: any, organizationId: string, chatId: string): Promise<boolean> {
    return checkBotStatusConfigurable(supabase, organizationId, chatId, true, true);
}

export async function checkBotStatusConfigurable(
    supabase: any, organizationId: string, chatId: string,
    checkGlobal: boolean, checkLead: boolean
): Promise<boolean> {
    if (checkGlobal) {
        const { data: botSettings } = await supabase
            .from("bot_settings")
            .select("global_bot_enabled")
            .eq("organization_id", organizationId)
            .maybeSingle();
        if (botSettings && botSettings.global_bot_enabled === false) return false;
    }

    if (checkLead) {
        const { data: chat } = await supabase
            .from("chats")
            .select("agent_off, bot_permanently_stopped")
            .eq("id", chatId)
            .maybeSingle();
        if (chat?.bot_permanently_stopped === true) return false;
        if (chat?.agent_off === true) return false;
    }

    return true;
}

export async function resolveVariables(supabase: any, chatId: string, organizationId: string): Promise<Record<string, string>> {
    const vars: Record<string, string> = {};

    const { data: chat } = await supabase
        .from("chats")
        .select("phone, custom_name, wa_name")
        .eq("id", chatId)
        .maybeSingle();

    if (chat) {
        vars.nome = chat.custom_name || chat.wa_name || chat.phone || "";
        vars.telefone = chat.phone || "";
    }

    const { data: fieldValues } = await supabase
        .from("chat_custom_field_values")
        .select("value, field_id")
        .eq("chat_id", chatId)
        .eq("organization_id", organizationId);

    if (fieldValues && fieldValues.length > 0) {
        const fieldIds = fieldValues.map((fv: any) => fv.field_id);
        const { data: fields } = await supabase
            .from("chat_custom_fields")
            .select("id, field_key")
            .in("id", fieldIds);

        const fieldMap = new Map((fields || []).map((f: any) => [f.id, f.field_key]));
        for (const fv of fieldValues) {
            const key = fieldMap.get(fv.field_id);
            if (typeof key === "string" && fv.value) vars[key] = String(fv.value);
        }
    }

    return vars;
}

export function interpolateText(text: string, vars: Record<string, string>): string {
    if (!text) return "";
    return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
        return vars[key.trim()] ?? match;
    });
}

export function comparePhoneNumbers(phone1: string, phone2: string): boolean {
    let p1 = String(phone1 || '').replace(/\D/g, '');
    let p2 = String(phone2 || '').replace(/\D/g, '');

    if (!p1 || !p2) return false;

    if (p1.length <= 11) p1 = '55' + p1;
    if (p2.length <= 11) p2 = '55' + p2;

    if (p1.startsWith('55') && p2.startsWith('55')) {
        const ddd1 = p1.substring(2, 4);
        const num1 = p1.substring(4);
        const base1 = num1.length === 9 ? num1.substring(1) : num1;

        const ddd2 = p2.substring(2, 4);
        const num2 = p2.substring(4);
        const base2 = num2.length === 9 ? num2.substring(1) : num2;
        return ddd1 === ddd2 && base1 === base2;
    }

    return p1 === p2;
}

export function evaluateCondition(config: any, context: any): boolean {
    const { condition_type, condition_value, operator, value, field, marketing_metric, marketing_operator } = config || {};

    const op = operator || condition_type;
    const expected = value || condition_value;

    if (op === "marketing_metrics") {
        const metricName = (marketing_metric || "CPL").toUpperCase();
        const targetValue = Number(expected || 0);
        const currentMetricValue = Number(context?.marketing_metrics?.[metricName] || 0);
        const mOp = marketing_operator || ">";
        switch (mOp) {
            case ">": return currentMetricValue > targetValue;
            case "<": return currentMetricValue < targetValue;
            case ">=": return currentMetricValue >= targetValue;
            case "<=": return currentMetricValue <= targetValue;
            default: return false;
        }
    }

    let testValue = "";
    if (field) {
        testValue = field;
    } else if (context?.last_response !== undefined) {
        testValue = context.last_response;
    }

    const val = String(testValue || "").trim().toLowerCase();
    const exp = String(expected || "").trim().toLowerCase();

    switch (op) {
        case "equals":
        case "response_equals":
            return val === exp;
        case "not_equals":
            return val !== exp;
        case "contains":
        case "response_contains":
            return val.includes(exp);
        case "not_contains":
            return !val.includes(exp);
        case "starts_with":
            return val.startsWith(exp);
        case "ends_with":
            return val.endsWith(exp);
        case "is_empty":
            return val === "";
        case "is_not_empty":
            return val !== "";
        case "greater_than":
            return Number(val) > Number(exp);
        case "less_than":
            return Number(val) < Number(exp);
        case "regex":
            try {
                return new RegExp(expected, "i").test(testValue);
            } catch { return false; }
        case "has_tag":
            return Array.isArray(context?.tags) && context.tags.includes(expected);
        case "is_assigned":
            return !!context?.assigned_to;
        case "response_is_one_of":
        case "response_in": {
            const valuesArray = Array.isArray(config?.condition_values)
                ? config.condition_values.map((v: string) => String(v).trim().toLowerCase())
                : String(expected || "").split(",").map((v: string) => v.trim().toLowerCase());
            return valuesArray.includes(val);
        }
        default:
            return true;
    }
}

export function toMsFromAmountUnit(amount: string | number, unit: string, fallbackMs: number): number {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
    if (unit === "minutes") return parsed * 60 * 1000;
    if (unit === "hours") return parsed * 60 * 60 * 1000;
    if (unit === "days") return parsed * 24 * 60 * 60 * 1000;
    return parsed * 1000;
}

export async function invokeWithRetry(
    supabase: any,
    functionName: string,
    options: any,
    maxRetries = 3,
    baseDelayMs = 1500
): Promise<any> {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const res = await supabase.functions.invoke(functionName, options);
            if (res.error) {
                console.warn(`[invokeWithRetry] Attempt ${attempt + 1} failed for ${functionName}:`, res.error);
                throw res.error;
            }
            if (res.data?.error) {
                // Internal API error from the Edge Function JSON response
                console.warn(`[invokeWithRetry] Attempt ${attempt + 1} failed internal for ${functionName}:`, res.data.error);
                throw new Error(res.data.error);
            }
            return res;
        } catch (error) {
            attempt++;
            if (attempt >= maxRetries) {
                console.error(`[invokeWithRetry] Max retries reached for ${functionName}`);
                return { error };
            }
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            console.log(`[invokeWithRetry] Retrying ${functionName} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

