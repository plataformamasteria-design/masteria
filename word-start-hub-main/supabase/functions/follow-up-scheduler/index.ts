import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[follow-up-scheduler] Starting scheduler run...");

    // Processar cada organização separadamente
    const { data: organizations } = await supabase
      .from("organizations")
      .select("id")
      .eq("active", true);

    if (!organizations || organizations.length === 0) {
      console.log("[follow-up-scheduler] No active organizations found");
      return new Response(
        JSON.stringify({ success: true, queued: 0, marked_as_lost: 0, marked_as_recovered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalQueued = 0;
    let totalMarkedAsLost = 0;
    let totalMarkedAsRecovered = 0;

    for (const org of organizations) {
      console.log(`[follow-up-scheduler] Processing organization: ${org.id}`);

      // 1. Find leads that need follow-up - add them to the queue instead of processing directly
      const { data: trackingData, error: trackingError } = await supabase
        .from("lead_follow_up_tracking")
        .select(`
          *,
          chats(id, wa_name, phone, last_message, updated_at)
        `)
        .eq("organization_id", org.id)
        .eq("completed", false)
        .eq("responded", false)
        .lte("next_trigger_at", new Date().toISOString());

      if (trackingError) throw trackingError;

      console.log(`[follow-up-scheduler] Found ${trackingData?.length || 0} leads to process for org ${org.id}`);

      for (const tracking of trackingData || []) {
        try {
          // NOVA LÓGICA: Verificar última mensagem válida (não de follow-up, não do sistema)
          const { data: lastValidMessage } = await supabase
            .from("messages")
            .select("is_from_user, created_at, content, is_follow_up")
            .eq("chat_id", tracking.chat_id)
            .eq("private", false)
            .or("is_follow_up.is.null,is_follow_up.eq.false")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Verificar se é mensagem do sistema
          const isSystemMessage = lastValidMessage?.content && (
            lastValidMessage.content.includes("atribuiu a conversa") ||
            lastValidMessage.content.includes("transferiu a conversa") ||
            lastValidMessage.content.includes("iniciou a conversa")
          );

          // Se a última mensagem válida é do agente (is_from_user = true) e não é follow-up
          // Isso significa que um agente humano respondeu ao lead
          if (lastValidMessage && lastValidMessage.is_from_user === true && !isSystemMessage) {
            console.log(`[follow-up-scheduler] Lead ${tracking.chats?.phone} was responded by agent, marking as recovered`);
            
            await supabase
              .from("lead_follow_up_tracking")
              .update({
                responded: true,
                responded_at_step: tracking.current_step,
                completed: true,
              })
              .eq("id", tracking.id);

            totalMarkedAsRecovered++;
            continue;
          }

          // Verificar se já existe um item na fila para este tracking/step (evitar duplicatas)
          const { data: existingQueueItem } = await supabase
            .from("follow_up_queue")
            .select("id")
            .eq("tracking_id", tracking.id)
            .eq("step_number", tracking.current_step)
            .in("status", ["pending", "processing"])
            .maybeSingle();

          if (existingQueueItem) {
            console.log(`[follow-up-scheduler] Queue item already exists for tracking ${tracking.id}, step ${tracking.current_step}`);
            continue;
          }

          // Get current step to check if tag already exists
          const { data: stepData } = await supabase
            .from("follow_up_steps")
            .select("tag_id")
            .eq("sequence_id", tracking.sequence_id)
            .eq("organization_id", org.id)
            .eq("step_number", tracking.current_step)
            .single();

          if (!stepData) continue;

          // Check if lead already has the tag for this step
          const { data: existingTag } = await supabase
            .from("chat_tags")
            .select("id")
            .eq("chat_id", tracking.chat_id)
            .eq("organization_id", org.id)
            .eq("tag_id", stepData.tag_id)
            .maybeSingle();

          if (existingTag) {
            console.log(`[follow-up-scheduler] Lead already has tag for step ${tracking.current_step}, skipping`);
            continue;
          }

          // Adicionar à fila
          const { error: queueError } = await supabase
            .from("follow_up_queue")
            .insert({
              organization_id: org.id,
              tracking_id: tracking.id,
              chat_id: tracking.chat_id,
              step_number: tracking.current_step,
              scheduled_at: new Date().toISOString(),
              status: "pending"
            });

          if (queueError) {
            console.error(`[follow-up-scheduler] Error adding to queue:`, queueError);
            continue;
          }

          totalQueued++;
          console.log(`[follow-up-scheduler] Added ${tracking.chats?.phone} to queue for step ${tracking.current_step}`);

        } catch (error) {
          console.error(`[follow-up-scheduler] Error processing lead ${tracking.chat_id}:`, error);
        }
      }

      // 2. Check for leads that completed without response and should be marked as lost
      // (24 hours after last step was sent)
      console.log(`[follow-up-scheduler] Checking for leads to mark as lost for org ${org.id}...`);
      
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      const { data: completedLeads } = await supabase
        .from("lead_follow_up_tracking")
        .select("id, chat_id, last_sent_at, organization_id")
        .eq("organization_id", org.id)
        .eq("completed", true)
        .eq("responded", false)
        .not("last_sent_at", "is", null)
        .lte("last_sent_at", twentyFourHoursAgo.toISOString());

      if (completedLeads && completedLeads.length > 0) {
        console.log(`[follow-up-scheduler] Found ${completedLeads.length} leads to mark as lost for org ${org.id}`);
        totalMarkedAsLost += completedLeads.length;
        
        // Find "Lead Frio" or "Lead Perdido" tag for this organization
        const { data: lostTag } = await supabase
          .from("tags")
          .select("id")
          .eq("organization_id", org.id)
          .or('name.ilike.%frio%,name.ilike.%perdido%')
          .limit(1)
          .maybeSingle();

        if (lostTag) {
          for (const lead of completedLeads) {
            // Check if tag doesn't exist yet
            const { data: existingLostTag } = await supabase
              .from("chat_tags")
              .select("id")
              .eq("chat_id", lead.chat_id)
              .eq("organization_id", org.id)
              .eq("tag_id", lostTag.id)
              .maybeSingle();

            if (!existingLostTag) {
              await supabase.from("chat_tags").insert({
                chat_id: lead.chat_id,
                tag_id: lostTag.id,
                organization_id: lead.organization_id,
              });
              console.log(`[follow-up-scheduler] Marked lead ${lead.chat_id} as lost (24h without response)`);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        queued: totalQueued,
        marked_as_lost: totalMarkedAsLost,
        marked_as_recovered: totalMarkedAsRecovered,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[follow-up-scheduler] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
