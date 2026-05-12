import { interpolateText, invokeWithRetry } from "../utils/shared.ts";

export async function handleSendMessage(
    supabase: any, config: any, organizationId: string, chatId: string, vars: any
) {
    let messageText = config.message || config.text;
    if (!messageText) return { success: true, message: "No message configured" };
    messageText = interpolateText(messageText, vars || {});

    const { data: insertedMsg, error } = await supabase
        .from("messages")
        .insert({
            chat_id: chatId,
            organization_id: organizationId,
            content: messageText,
            message_type: "text",
            is_from_user: true,
            sent_from_platform: true,
        })
        .select("id")
        .maybeSingle();

    if (error || !insertedMsg?.id) {
        return { success: false, message: error?.message || "Failed to create message" };
    }

    const evoRes = await invokeWithRetry(supabase, "send-to-evolution", {
        body: { messageId: insertedMsg.id },
    });
    if (evoRes?.error) {
        console.error("[automation] Evolution send failed after retries:", evoRes.error);
    } else {
        await new Promise(r => setTimeout(r, 2000));
    }

    return { success: true, message: `Message queued: ${messageText.substring(0, 50)}...` };
}

export async function handleAskQuestion(
    supabase: any, config: any, organizationId: string, chatId: string, vars: any
) {
    let questionText = config.question;
    const options = config.options || [];
    if (!questionText) return { success: true, message: "No question configured" };
    questionText = interpolateText(questionText, vars || {});

    let fullMessage = questionText;
    if (options.length > 0) {
        fullMessage += "\n\n" + options.map((opt: string, i: number) => `${i + 1}. ${interpolateText(opt, vars || {})}`).join("\n");
    }

    const { data: insertedQuestion, error } = await supabase
        .from("messages")
        .insert({
            chat_id: chatId,
            organization_id: organizationId,
            content: fullMessage,
            message_type: "text",
            is_from_user: true,
            sent_from_platform: true,
        })
        .select("id")
        .maybeSingle();

    if (error || !insertedQuestion?.id) {
        return { success: false, message: error?.message || "Failed to create question message" };
    }

    const evoQ = await invokeWithRetry(supabase, "send-to-evolution", {
        body: { messageId: insertedQuestion.id },
    });
    if (evoQ?.error) {
        console.error("[automation] Evolution question send failed after retries:", evoQ.error);
    } else {
        await new Promise(r => setTimeout(r, 2000));
    }

    return { success: true, message: `Question queued: ${questionText.substring(0, 50)}` };
    return { success: true, message: `Question queued: ${questionText.substring(0, 50)}` };
}

export async function handleSendToNumber(
    supabase: any, config: any, organizationId: string, chatId: string, vars: any, context: any
) {
    let messageText = config.message || config.text;
    const targetPhone = config.target_phone;
    const sourceType = config.source_type || "custom";

    if (sourceType === "ai_agent") {
        const sourceNodeId = config.source_ai_node_id || "";
        const aiOutput = context?.[`node_${sourceNodeId}_ai_output`] || context?.ai_agent_output || "";
        if (!aiOutput || !aiOutput.trim()) {
            return { success: false, message: "⚠️ Nenhuma resposta gerada pela I.A capturada no contexto." };
        }
        messageText = aiOutput;
    } else {
        if (!messageText) return { success: true, message: "No message configured" };
    }
    if (!targetPhone) return { success: false, message: "No target phone configured" };

    // Resolve variables but allow dynamic input like {{nome}} only if testing. 
    messageText = interpolateText(messageText, vars || {});

    const sendBody = {
        organization_id: organizationId,
        phone: targetPhone,
        message: messageText,
        message_type: "text",
    };

    const evoRes = await invokeWithRetry(supabase, "send-to-evolution", {
        body: sendBody,
    });

    if (evoRes?.error) {
        console.error("[automation] send_to_number failed:", evoRes.error);
        return { success: false, message: "Failed to send to number" };
    }

    return { success: true, message: `Message sent to ${targetPhone}` };
}
