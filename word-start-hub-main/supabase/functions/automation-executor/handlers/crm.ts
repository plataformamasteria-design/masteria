export async function handleCrmMove(supabase: any, config: any, organizationId: string, chatId: string) {
    const { funnel_id, stage_id } = config;
    if (!funnel_id || !stage_id) return { success: true, message: "No CRM config" };

    const { data: existing } = await supabase
        .from("chat_funnel_stage")
        .select("id")
        .eq("chat_id", chatId)
        .eq("funnel_id", funnel_id)
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (existing) {
        await supabase.from("chat_funnel_stage")
            .update({ stage_id, moved_at: new Date().toISOString() })
            .eq("id", existing.id);
    } else {
        await supabase.from("chat_funnel_stage").insert({
            chat_id: chatId,
            funnel_id,
            stage_id,
            organization_id: organizationId,
        });
    }
    return { success: true, message: `Moved to stage ${stage_id}` };
}

export async function handleAction(supabase: any, config: any, organizationId: string, chatId: string, context: any) {
    const actionType = config.action_type;

    if (actionType === "add_tag" && config.tag_id) {
        await supabase.from("chat_tags").insert({
            chat_id: chatId, tag_id: config.tag_id, organization_id: organizationId,
        });
        return { success: true, message: `Tag ${config.tag_id} added` };
    }

    if (actionType === "remove_tag" && config.tag_id) {
        await supabase.from("chat_tags").delete()
            .eq("chat_id", chatId).eq("tag_id", config.tag_id).eq("organization_id", organizationId);
        return { success: true, message: `Tag ${config.tag_id} removed` };
    }

    if (actionType === "assign_agent" && config.agent_id) {
        await supabase.from("chats")
            .update({ assigned_to: config.agent_id, assigned_at: new Date().toISOString() })
            .eq("id", chatId);
        return { success: true, message: `Assigned to ${config.agent_id}` };
    }

    if (actionType === "assign_team" && config.team_id) {
        await supabase.from("chats")
            .update({ team_id: config.team_id, assigned_at: new Date().toISOString() })
            .eq("id", chatId);
        return { success: true, message: `Assigned to team_id ${config.team_id}` };
    }

    if (actionType === "assign_dynamic") {
        const { data: onlineProfiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("is_online", true);

        if (onlineProfiles && onlineProfiles.length > 0) {
            const { data: chatCounts } = await supabase
                .from("chats")
                .select("assigned_to")
                .eq("organization_id", organizationId)
                .in("status", ["open", "pending"])
                .not("assigned_to", "is", null);

            const loadMap: Record<string, number> = {};
            onlineProfiles.forEach((p: any) => loadMap[p.id] = 0);

            chatCounts?.forEach((c: any) => {
                if (c.assigned_to && loadMap[c.assigned_to] !== undefined) {
                    loadMap[c.assigned_to]++;
                }
            });

            let bestAgentId = onlineProfiles[0].id;
            let minLoad = Infinity;
            Object.entries(loadMap).forEach(([id, load]) => {
                if (load < minLoad) {
                    minLoad = load;
                    bestAgentId = id;
                }
            });

            await supabase.from("chats")
                .update({ assigned_to: bestAgentId, assigned_at: new Date().toISOString() })
                .eq("id", chatId);

            return { success: true, message: `Assigned dynamically to agent ${bestAgentId}` };
        } else {
            return { success: true, message: `Dynamic assignment bypassed, no agents online` };
        }
    }

    if (actionType === "webhook" && config.webhook_url) {
        fetch(config.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, organization_id: organizationId, context }),
        }).catch((e: any) => console.error("Webhook error:", e));
        return { success: true, message: `Webhook fired` };
    }

    return { success: true, message: `Action: ${actionType || "none"}` };
}

export async function handleBotToggle(supabase: any, config: any, chatId: string) {
    const botAction = config.bot_action || "enable";
    const agentOff = botAction === "disable";
    const notifyFinished = config.notify_finished || false;

    const updateData: any = { agent_off: agentOff };
    if (notifyFinished && agentOff) {
        updateData.bot_finished_at = new Date().toISOString();
    }
    if (notifyFinished && !agentOff) {
        updateData.bot_finished_at = null;
    }

    const { error: botError } = await supabase
        .from("chats")
        .update(updateData)
        .eq("id", chatId);

    if (botError) return { success: false, message: `Bot toggle error: ${botError.message}` };
    return { success: true, message: `Bot ${agentOff ? "disabled" : "enabled"} for chat${notifyFinished ? " (notified)" : ""}` };
}
