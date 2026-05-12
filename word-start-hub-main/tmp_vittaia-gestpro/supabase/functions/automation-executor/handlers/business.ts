export async function handleMarketingData(supabase: any, organizationId: string, nodeLabel: string, context: any, config?: any) {
    let query = supabase.from('marketing_campaigns').select('*').eq('organization_id', organizationId);

    const dateRange = config?.date_range || "all";
    if (dateRange !== "all") {
        const days = parseInt(dateRange) || 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', since);
    }

    const { data: campaigns } = await query;
    let formattedText = "Sem dados de campanhas ativos.";
    if (campaigns && campaigns.length > 0) {
        const regularCampaigns = campaigns.filter((c: any) => !c.raw_data?.is_account_total);
        const isMessageObj = (c: any) => c.raw_data?.objective === 'MESSAGES' || c.raw_data?.objective === 'OUTCOME_ENGAGEMENT' || (c.campaign_name || '').includes('[MSGS]');

        const totalSpend = regularCampaigns.reduce((s: number, c: any) => s + (c.spend || 0), 0);
        const totalClicks = regularCampaigns.reduce((s: number, c: any) => s + (c.clicks || 0), 0);
        const totalImpressions = regularCampaigns.reduce((s: number, c: any) => s + (c.impressions || 0), 0);
        const totalLeads = regularCampaigns.filter(isMessageObj).reduce((s: number, c: any) => s + (c.conversions || 0), 0);
        const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
        const roas = totalSpend > 0 ? (regularCampaigns.reduce((s: number, c: any) => s + (c.roas || 0), 0)) : 0;
        const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100) : 0;
        const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

        const campaignDetails = regularCampaigns.map((c: any) =>
            `Campanha: ${c.campaign_name}\nStatus: ${c.status}\nGasto: R$ ${(c.spend || 0).toFixed(2)}\nCliques: ${c.clicks || 0}\nImpressões: ${c.impressions || 0}\nConversões: ${c.conversions || 0}\nROAS: ${c.roas || 0}`
        ).join("\n\n");

        formattedText = `=== RESUMO GERAL ===\nValor Investido: R$ ${totalSpend.toFixed(2)}\nLeads (Mensagens Iniciadas): ${totalLeads}\nCusto por Lead: R$ ${cpl.toFixed(2)}\nCliques Totais: ${totalClicks}\nImpressões: ${totalImpressions}\nCTR: ${ctr.toFixed(2)}%\nCPC Médio: R$ ${cpc.toFixed(2)}\n\n=== CAMPANHAS ===\n${campaignDetails}`;

        if (context) {
            context.marketing_metrics = { CPL: cpl, ROAS: roas, CTR: ctr, CPC: cpc };
        }
    }

    // Fetch KPI goals if enabled
    if (config?.include_kpis) {
        try {
            const { data: org } = await supabase.from('organizations').select('settings').eq('id', organizationId).maybeSingle();
            const kpis = org?.settings?.marketing_kpis;
            if (kpis) {
                const kpiLines: string[] = ["\n\n=== METAS KPI (Objetivos) ==="];
                if (kpis.target_cpl != null) kpiLines.push(`Meta CPL: R$ ${kpis.target_cpl}`);
                if (kpis.target_roas != null) kpiLines.push(`Meta ROAS: ${kpis.target_roas}x`);
                if (kpis.target_cpc != null) kpiLines.push(`Meta CPC: R$ ${kpis.target_cpc}`);
                if (kpis.target_ctr != null) kpiLines.push(`Meta CTR: ${kpis.target_ctr}%`);
                if (kpis.target_cpm != null) kpiLines.push(`Meta CPM: R$ ${kpis.target_cpm}`);
                if (kpiLines.length > 1) formattedText += kpiLines.join("\n");
            }
        } catch { }
    }

    if (context) {
        context.marketing_data = campaigns || [];
        context[nodeLabel] = {
            $json: { formatted_text: formattedText, marketing_data: campaigns || [] }
        };
    }
    return { success: true, message: `Consultou ${campaigns?.length || 0} campanhas` };
}

export async function handleWaLists(supabase: any, organizationId: string, context: any) {
    const { data: lists } = await supabase.from('broadcast_lists').select('id, name, description').eq('organization_id', organizationId);
    if (context) context.wa_lists = lists || [];
    return { success: true, message: `Consultou ${lists?.length || 0} listas` };
}

export async function handleSendMetaTemplate(supabase: any, config: any, organizationId: string, chatId: string) {
    const templateId = config.template_id;
    if (!templateId) return { success: false, message: "Template não configurado" };

    const { data: template } = await supabase.from('wa_official_templates').select('*').eq('id', templateId).single();
    if (!template) return { success: false, message: "Template não encontrado" };

    const { data: org } = await supabase.from('organizations').select('settings').eq('id', organizationId).single();
    const settings = org?.settings || {};
    const phoneNumberId = settings.whatsapp_cloud_phone_number_id;
    const accessToken = settings.whatsapp_cloud_access_token;
    if (!phoneNumberId || !accessToken) return { success: false, message: "WhatsApp Cloud API não configurada" };

    const { data: chatData } = await supabase.from('chats').select('phone').eq('id', chatId).single();
    const recipientPhone = chatData?.phone;
    if (!recipientPhone) return { success: false, message: "Lead sem telefone" };

    const waPayload = {
        messaging_product: 'whatsapp', recipient_type: 'individual', to: recipientPhone, type: 'template',
        template: { name: template.name, language: { code: template.language }, components: template.components || [] }
    };

    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify(waPayload),
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error?.message);

        await supabase.from('messages').insert({
            chat_id: chatId, organization_id: organizationId,
            content: `[Template Meta Enviado]: ${template.name}`,
            message_type: 'text', is_from_user: false, sent_from_platform: true, status: 'sent'
        });
        return { success: true, message: `Template ${template.name} enviado.` };
    } catch (e: any) {
        return { success: false, message: `Erro ao enviar template: ${e.message}` };
    }
}

export async function handleFinanceiro(supabase: any, config: any, organizationId: string, chatId: string) {
    const transType = config.transaction_type || "income";
    const amount = parseFloat(config.amount || "0");
    const productName = config.product_name || "";
    const description = config.description || "Gerado por automação";

    const { data: chatData } = await supabase
        .from("chats").select("phone, wa_name, custom_name").eq("id", chatId).maybeSingle();
    const clientName = chatData?.custom_name || chatData?.wa_name || chatData?.phone || "Lead";

    const { error: txError } = await supabase.from("transactions").insert({
        organization_id: organizationId, type: transType, amount: amount,
        description: description, product_name: productName, client_name: clientName,
        chat_id: chatId, purchase_date: new Date().toISOString(),
    });

    if (txError) return { success: false, message: `Finance error: ${txError.message}` };
    return { success: true, message: `Transaction created: R$ ${amount}` };
}

export async function handleAgenda(supabase: any, config: any, organizationId: string, chatId: string) {
    const eventTitle = config.event_title || "Evento automático";
    const eventDesc = config.event_description || "";
    const durationMin = parseInt(config.duration || "30", 10);
    const scheduleMode = config.schedule_mode || "auto";

    let startTime: Date;
    if (scheduleMode === "custom" && config.custom_date) {
        const dateStr = config.custom_date + "T" + (config.custom_time || "10:00") + ":00";
        startTime = new Date(dateStr);
        if (isNaN(startTime.getTime())) {
            startTime = new Date();
            startTime.setHours(startTime.getHours() + 1);
        }
    } else {
        startTime = new Date();
        startTime.setHours(startTime.getHours() + 1);
    }
    const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

    const { data: insertedEvt, error: evtError } = await supabase.from("calendar_events").insert({
        organization_id: organizationId, chat_id: chatId, title: eventTitle,
        description: eventDesc, start_time: startTime.toISOString(), end_time: endTime.toISOString(),
    }).select('id').single();

    if (evtError) return { success: false, message: `Agenda error: ${evtError.message}` };

    const generateMeetLink = config.generate_meet_link ?? true;
    const { data: gcData } = await supabase.functions.invoke('google-calendar-api', {
        body: { action: 'push_event', organization_id: organizationId, event_id: insertedEvt.id, generate_meet_link: generateMeetLink }
    });

    const notifyLead = config.notify_lead ?? true;
    if (notifyLead) {
        let meetLinkToUse = gcData?.meet_link;
        if (!meetLinkToUse) {
            const { data: latestDb } = await supabase.from('calendar_events').select('location').eq('id', insertedEvt.id).single();
            if (latestDb?.location && latestDb.location.includes("meet.google.com")) {
                meetLinkToUse = latestDb.location.split('|').map((s: string) => s.trim()).find((s: string) => s.includes('meet.google.com')) || latestDb.location;
            }
        }
        const d = startTime;
        const datePart = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        let msgContent = `*${eventTitle}*\n${datePart} - ${timePart}\n\n`;
        if (meetLinkToUse && generateMeetLink) msgContent += `${meetLinkToUse}\n\n`;
        if (eventDesc) msgContent += `_${eventDesc}_\n\n`;
        msgContent += `Compromisso agendado! e te espero lá!`;

        const { data: insertedMsg } = await supabase.from('messages').insert({
            chat_id: chatId, organization_id: organizationId, content: msgContent,
            message_type: 'text', is_from_user: true, sent_from_platform: true
        }).select('id').single();

        if (insertedMsg) {
            await supabase.functions.invoke('trigger-sent-webhooks', { body: { messageId: insertedMsg.id } });
        }
    }

    // Pre-Event Reminder Integration
    if (config.send_reminder && insertedEvt?.id) {
        const reminderHours = parseInt(config.reminder_hours_before || "1", 10);
        const reminderTime = new Date(startTime.getTime() - reminderHours * 60 * 60 * 1000);
        if (reminderTime > new Date()) {
            const d = startTime;
            const datePart = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const customMsg = config.reminder_message ? config.reminder_message : `⏰ Lembrete: *${eventTitle}* em ${reminderHours}h (${datePart} às ${timePart})`;
            await supabase.from("scheduled_messages").insert({
                chat_id: chatId,
                organization_id: organizationId,
                content: customMsg,
                scheduled_for: reminderTime.toISOString(),
                status: "pending",
            });
        }
    }

    return { success: true, message: `Event created: ${eventTitle}` };
}
