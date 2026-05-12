import { evaluateCondition, interpolateText } from "../utils/shared.ts";

export async function handleEditFields(config: any, context: any, vars: any) {
    const { mode = "manual", fields = [], json_value } = config;
    const resolvedVars = vars || {};

    if (mode === "json" && json_value) {
        try {
            const parsed = JSON.parse(interpolateText(json_value, resolvedVars));
            Object.assign(context, parsed);
        } catch (e) { console.error("Edit fields JSON parse error:", e); }
    } else {
        fields.forEach((f: any) => {
            if (f.name) {
                let val: any = interpolateText(f.value, resolvedVars);
                if (f.type === "number") val = Number(val);
                else if (f.type === "boolean") val = val === "true" || val === true;
                else if (f.type === "object" || f.type === "array") {
                    try { val = JSON.parse(val); } catch { }
                }
                context[f.name] = val;
            }
        });
    }
    return { success: true, message: `Campos atualizados` };
}

export async function handleCaptureInfo(supabase: any, config: any, organizationId: string, chatId: string, context: any, vars: any) {
    const { field_key, question } = config;
    if (!question) return { success: true, message: "Sem pergunta configurada" };

    const resolvedVars = vars || {};
    const questionText = interpolateText(question, resolvedVars);

    const { data: insertedMsg, error } = await supabase
        .from("messages")
        .insert({
            chat_id: chatId,
            organization_id: organizationId,
            content: questionText,
            message_type: "text",
            is_from_user: true,
            sent_from_platform: true,
        })
        .select("id")
        .maybeSingle();

    if (error || !insertedMsg?.id) return { success: false, message: error?.message || "Erro ao criar mensagem" };

    await supabase.functions.invoke("send-to-evolution", { body: { messageId: insertedMsg.id } });

    if (context) {
        context.capture_field = field_key;
        context.capture_auto_save = config.auto_save_crm ?? true;
    }
    return { success: true, message: `Capturando: ${field_key}` };
}

export async function handleCode(config: any, context: any, nodeId: string) {
    const { language = "javascript", code } = config;
    if (!code) return { success: true, message: "Sem código" };
    if (language !== "javascript") return { success: false, message: "Apenas JavaScript é suportado" };

    try {
        const fn = new Function("input", "context", code);
        const result = fn(context.last_response_data || {}, context);
        context[`node_${nodeId}_output`] = result;
        return { success: true, message: "Código executado" };
    } catch (e: any) {
        return { success: false, message: `Erro no código: ${e.message}` };
    }
}

export async function handleFilter(config: any, context: any, vars: any, nodeId: string) {
    const { conditions = [], match_mode = "all" } = config;
    const resolvedVars = vars || {};

    const resList = conditions.map((cond: any) => {
        const fieldVal = interpolateText(cond.field, resolvedVars);
        const expectedVal = interpolateText(cond.value, resolvedVars);
        return evaluateCondition({ condition_type: cond.operator, condition_value: expectedVal }, { last_response: fieldVal });
    });

    const passed = match_mode === "all" ? resList.every((r: boolean) => r) : resList.some((r: boolean) => r);
    if (context) context[`node_${nodeId}_passed`] = passed;

    return { success: true, message: passed ? "Filtro: Passou" : "Filtro: Bloqueado" };
}

export async function handleRouter(config: any, context: any, vars: any, nodeId: string) {
    const { rules = [], mode = "rules" } = config;
    const resolvedVars = vars || {};

    let matchingIndex = -1;
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const fieldVal = interpolateText(rule.field, resolvedVars);
        const expectedVal = interpolateText(rule.value, resolvedVars);

        if (evaluateCondition({ operator: rule.operator, value: expectedVal, field: fieldVal }, resolvedVars)) {
            matchingIndex = i;
            break;
        }
    }

    if (context) context[`node_${nodeId}_matching_index`] = matchingIndex;
    return { success: true, message: matchingIndex >= 0 ? `Roteado para branch ${matchingIndex + 1}` : "Nenhuma regra correspondente" };
}

export async function handleLoopRestart(config: any, context: any) {
    const restartDelay = parseInt(config.restart_delay || "8", 10);
    const restartUnit = config.restart_unit || "hours";
    const maxReps = parseInt(config.max_repetitions || "0", 10);
    const currentCount = (context?.loop_count || 0) + 1;

    if (maxReps > 0 && currentCount >= maxReps) {
        if (context) {
            context.loop_restart = false;
            context.loop_max_reached = true;
            context.loop_count = currentCount;
        }
        return { success: true, message: `Loop: limite de ${maxReps} repetições atingido. Finalizando.` };
    }

    let delayMs = restartDelay * 60 * 60 * 1000;
    if (restartUnit === "minutes") delayMs = restartDelay * 60 * 1000;
    else if (restartUnit === "days") delayMs = restartDelay * 24 * 60 * 60 * 1000;

    const restartAfter = new Date(Date.now() + delayMs).toISOString();

    if (context) {
        context.loop_restart = true;
        context.restart_at = restartAfter;
        context.loop_count = currentCount;
    }

    return { success: true, message: `Loop restart ${currentCount}/${maxReps || "∞"} scheduled after ${restartDelay} ${restartUnit}.` };
}

export async function handleStopBot(supabase: any, chatId: string) {
    const { error: stopError } = await supabase
        .from("chats")
        .update({
            agent_off: true,
            bot_permanently_stopped: true,
            bot_finished_at: new Date().toISOString()
        })
        .eq("id", chatId);

    if (stopError) return { success: false, message: `Stop bot error: ${stopError.message}` };
    return { success: true, message: "Bot permanently stopped for this lead" };
}
