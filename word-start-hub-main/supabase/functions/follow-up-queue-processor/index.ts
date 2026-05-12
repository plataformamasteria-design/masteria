import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Delay entre processamento de itens da fila (5 segundos)
const QUEUE_DELAY_MS = 5000;
// Delay entre envio de mensagens do mesmo step (2 segundos)
const MESSAGE_DELAY_MS = 2000;

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

// Helper para obter config da Evolution API
async function getEvolutionConfig(supabase: any, organizationId: string, overrideInstanceName?: string | null): Promise<EvolutionConfig | null> {
  // Primeiro tenta config específica da organização
  const { data: orgData } = await supabase
    .from("organizations")
    .select("evolution_api_url, evolution_api_key, instance_name")
    .eq("id", organizationId)
    .single();

  if (orgData?.evolution_api_url && orgData?.evolution_api_key) {
    const instanceName = overrideInstanceName || orgData.instance_name || orgData.slug;
    return {
      apiUrl: orgData.evolution_api_url.replace(/\/$/, ""),
      apiKey: orgData.evolution_api_key,
      instanceName: instanceName,
    };
  }

  // Fallback para config global
  const { data: globalConfigs } = await supabase
    .from("global_config")
    .select("key, value")
    .in("key", ["evolution_api_url", "evolution_api_key"]);

  if (globalConfigs && globalConfigs.length >= 2) {
    const apiUrl = globalConfigs.find((c: any) => c.key === "evolution_api_url")?.value;
    const apiKey = globalConfigs.find((c: any) => c.key === "evolution_api_key")?.value;
    
    if (apiUrl && apiKey) {
      const instanceName = overrideInstanceName || orgData?.instance_name || orgData?.slug;
      return {
        apiUrl: apiUrl.replace(/\/$/, ""),
        apiKey,
        instanceName: instanceName,
      };
    }
  }

  return null;
}

// Helper para enviar texto via Evolution API
async function sendTextMessage(config: EvolutionConfig, phone: string, text: string): Promise<any> {
  const url = `${config.apiUrl}/message/sendText/${config.instanceName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.apiKey,
    },
    body: JSON.stringify({
      number: phone,
      text: text,
    }),
  });
  return response.json();
}

// Helper para enviar mídia via Evolution API
async function sendMediaMessage(config: EvolutionConfig, phone: string, mediaUrl: string, caption: string, mediaType: string): Promise<any> {
  const url = `${config.apiUrl}/message/sendMedia/${config.instanceName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.apiKey,
    },
    body: JSON.stringify({
      number: phone,
      mediatype: mediaType,
      media: mediaUrl,
      caption: caption || "",
    }),
  });
  return response.json();
}

// Helper para enviar áudio via Evolution API
async function sendAudioMessage(config: EvolutionConfig, phone: string, audioUrl: string): Promise<any> {
  const url = `${config.apiUrl}/message/sendWhatsAppAudio/${config.instanceName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.apiKey,
    },
    body: JSON.stringify({
      number: phone,
      audio: audioUrl,
    }),
  });
  return response.json();
}

// Helper para enviar documento via Evolution API
async function sendDocumentMessage(config: EvolutionConfig, phone: string, docUrl: string, fileName: string): Promise<any> {
  const url = `${config.apiUrl}/message/sendMedia/${config.instanceName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.apiKey,
    },
    body: JSON.stringify({
      number: phone,
      mediatype: "document",
      media: docUrl,
      fileName: fileName || "documento",
    }),
  });
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[follow-up-queue-processor] Starting queue processing...");

    // Buscar o próximo item da fila (o mais antigo com status pending)
    const { data: queueItem, error: queueError } = await supabase
      .from("follow_up_queue")
      .select(`
        *,
        lead_follow_up_tracking(
          sequence_id,
          current_step,
          chats(id, phone, channel, wa_name, organization_id)
        )
      `)
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queueError) throw queueError;

    if (!queueItem) {
      console.log("[follow-up-queue-processor] No pending items in queue");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending items" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[follow-up-queue-processor] Processing queue item: ${queueItem.id}`);

    // Marcar como processing
    await supabase
      .from("follow_up_queue")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", queueItem.id);

    try {
      const tracking = queueItem.lead_follow_up_tracking;
      const chat = tracking?.chats;
      
      if (!tracking || !chat) {
        throw new Error("Invalid tracking or chat data");
      }

      // Verificar se lead respondeu antes de enviar (verificar última mensagem válida)
      const { data: lastValidMessage } = await supabase
        .from("messages")
        .select("is_from_user, created_at, is_follow_up")
        .eq("chat_id", chat.id)
        .eq("private", false)
        .or("is_follow_up.is.null,is_follow_up.eq.false")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Se última mensagem válida é do lead (is_from_user = false), podemos continuar
      // Se é do agente (is_from_user = true) e não é follow-up, lead foi atendido
      if (lastValidMessage && lastValidMessage.is_from_user === true && lastValidMessage.is_follow_up !== true) {
        console.log(`[follow-up-queue-processor] Lead was responded by agent, marking as recovered`);
        
        await supabase
          .from("lead_follow_up_tracking")
          .update({
            responded: true,
            responded_at_step: queueItem.step_number,
            completed: true,
          })
          .eq("id", queueItem.tracking_id);

        await supabase
          .from("follow_up_queue")
          .update({ 
            status: "completed", 
            completed_at: new Date().toISOString(),
            error_message: "Lead already responded by agent"
          })
          .eq("id", queueItem.id);

        return new Response(
          JSON.stringify({ success: true, processed: 0, skipped: 1, reason: "lead_responded" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar o step atual
      const { data: stepData } = await supabase
        .from("follow_up_steps")
        .select("*, tags(name, id)")
        .eq("sequence_id", tracking.sequence_id)
        .eq("organization_id", queueItem.organization_id)
        .eq("step_number", queueItem.step_number)
        .single();

      if (!stepData) {
        throw new Error(`Step ${queueItem.step_number} not found`);
      }

      // Verificar se lead já tem a tag do step (já processado)
      const { data: existingTag } = await supabase
        .from("chat_tags")
        .select("id")
        .eq("chat_id", queueItem.chat_id)
        .eq("organization_id", queueItem.organization_id)
        .eq("tag_id", stepData.tag_id)
        .maybeSingle();

      if (existingTag) {
        console.log(`[follow-up-queue-processor] Lead already has tag for step ${queueItem.step_number}, skipping`);
        await supabase
          .from("follow_up_queue")
          .update({ 
            status: "completed", 
            completed_at: new Date().toISOString(),
            error_message: "Already processed (tag exists)"
          })
          .eq("id", queueItem.id);
        
        return new Response(
          JSON.stringify({ success: true, processed: 0, skipped: 1 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar mensagens do step (nova tabela)
      const { data: stepMessages } = await supabase
        .from("follow_up_step_messages")
        .select("*")
        .eq("step_id", stepData.id)
        .eq("organization_id", queueItem.organization_id)
        .order("message_order");

      // Se não tem mensagens na nova tabela, usar a mensagem legada
      let messages = stepMessages || [];
      if (messages.length === 0 && stepData.message) {
        messages = [{ message_type: "text", content: stepData.message }];
      }

      console.log(`[follow-up-queue-processor] Sending ${messages.length} messages for step ${queueItem.step_number}`);

      // Obter configuração da Evolution API
      const evolutionConfig = await getEvolutionConfig(supabase, queueItem.organization_id, chat.channel);

      if (!evolutionConfig) {
        throw new Error("Evolution API not configured for this organization");
      }

      // Enviar cada mensagem com delay entre elas
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        
        console.log(`[follow-up-queue-processor] Sending message ${i + 1}/${messages.length} to ${chat.phone}`);

        // 1. Inserir mensagem na tabela messages com is_follow_up = true
        const { data: insertedMessage, error: insertError } = await supabase
          .from("messages")
          .insert({
            chat_id: chat.id,
            organization_id: queueItem.organization_id,
            content: msg.content || "",
            message_type: msg.message_type || "text",
            file_url: msg.file_url || null,
            file_name: msg.file_name || null,
            is_from_user: true, // Mensagem enviada pela plataforma
            sent_from_platform: true,
            is_follow_up: true, // Marcar como mensagem de follow-up
            private: false,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error(`[follow-up-queue-processor] Error inserting message:`, insertError);
          throw insertError;
        }

        // 2. Enviar via Evolution API baseado no tipo de mensagem
        let evolutionResponse: any;
        
        try {
          switch (msg.message_type) {
            case "audio":
              if (msg.file_url) {
                evolutionResponse = await sendAudioMessage(evolutionConfig, chat.phone, msg.file_url);
              }
              break;
            case "image":
            case "video":
              if (msg.file_url) {
                evolutionResponse = await sendMediaMessage(
                  evolutionConfig, 
                  chat.phone, 
                  msg.file_url, 
                  msg.content || "", 
                  msg.message_type
                );
              }
              break;
            case "document":
              if (msg.file_url) {
                evolutionResponse = await sendDocumentMessage(
                  evolutionConfig, 
                  chat.phone, 
                  msg.file_url, 
                  msg.file_name || "documento"
                );
              }
              break;
            case "text":
            default:
              if (msg.content) {
                evolutionResponse = await sendTextMessage(evolutionConfig, chat.phone, msg.content);
              }
              break;
          }

          console.log(`[follow-up-queue-processor] Evolution API response:`, JSON.stringify(evolutionResponse));
        } catch (apiError) {
          console.error(`[follow-up-queue-processor] Evolution API error for message ${i + 1}:`, apiError);
        }

        // Delay entre mensagens (exceto após a última)
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY_MS));
        }
      }

      // Atualizar last_message do chat
      const lastMsgContent = messages[messages.length - 1]?.content || "[Follow-up enviado]";
      await supabase
        .from("chats")
        .update({ 
          last_message: lastMsgContent.substring(0, 100),
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", chat.id);

      // Adicionar tag ao chat
      await supabase.from("chat_tags").insert({
        chat_id: queueItem.chat_id,
        tag_id: stepData.tag_id,
        organization_id: queueItem.organization_id,
      });

      // Atualizar tracking
      const sentAt = new Date().toISOString();
      
      // Verificar se é o último step
      const { count } = await supabase
        .from("follow_up_steps")
        .select("*", { count: "exact", head: true })
        .eq("sequence_id", tracking.sequence_id)
        .eq("organization_id", queueItem.organization_id);

      if (queueItem.step_number >= (count || 0)) {
        // Último step
        await supabase
          .from("lead_follow_up_tracking")
          .update({ 
            last_sent_at: sentAt,
            completed: true 
          })
          .eq("id", queueItem.tracking_id);
      } else {
        // Buscar próximo step para calcular next_trigger_at
        const { data: nextStep } = await supabase
          .from("follow_up_steps")
          .select("delay_hours")
          .eq("sequence_id", tracking.sequence_id)
          .eq("organization_id", queueItem.organization_id)
          .eq("step_number", queueItem.step_number + 1)
          .single();

        if (nextStep) {
          const nextTrigger = new Date(sentAt);
          const delayMs = Math.round(nextStep.delay_hours * 3600000);
          nextTrigger.setTime(nextTrigger.getTime() + delayMs);

          await supabase
            .from("lead_follow_up_tracking")
            .update({
              current_step: queueItem.step_number + 1,
              next_trigger_at: nextTrigger.toISOString(),
              last_sent_at: sentAt,
            })
            .eq("id", queueItem.tracking_id);
        }
      }

      // Marcar item da fila como completed
      await supabase
        .from("follow_up_queue")
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString() 
        })
        .eq("id", queueItem.id);

      // Log no webhook log
      await supabase.from("follow_up_webhook_log").insert({
        chat_id: queueItem.chat_id,
        tracking_id: queueItem.tracking_id,
        step_number: queueItem.step_number,
        webhook_payload: { messages_sent: messages.length, via: "evolution_api" },
        webhook_response: { success: true },
        success: true,
        organization_id: queueItem.organization_id,
      });

      console.log(`[follow-up-queue-processor] Successfully processed queue item ${queueItem.id}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 1, 
          messages_sent: messages.length,
          queue_item_id: queueItem.id 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (processError) {
      console.error(`[follow-up-queue-processor] Error processing item:`, processError);
      
      // Marcar como failed
      await supabase
        .from("follow_up_queue")
        .update({ 
          status: "failed", 
          error_message: processError instanceof Error ? processError.message : "Unknown error"
        })
        .eq("id", queueItem.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: processError instanceof Error ? processError.message : "Unknown error" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("[follow-up-queue-processor] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
