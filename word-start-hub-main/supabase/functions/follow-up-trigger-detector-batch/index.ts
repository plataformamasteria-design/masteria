import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('[follow-up-trigger-detector-batch] Starting batch processing...');

    // Processar cada organização separadamente
    const { data: organizations } = await supabaseClient
      .from('organizations')
      .select('id')
      .eq('active', true);

    if (!organizations || organizations.length === 0) {
      console.log('[follow-up-trigger-detector-batch] No active organizations found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active organizations', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalProcessed = 0;
    let totalCreated = 0;

    for (const org of organizations) {
      console.log(`[follow-up-trigger-detector-batch] Processing organization: ${org.id}`);

      // 1. Buscar todas as tags de gatilho de sequências ativas desta organização
      const { data: activeTriggers, error: triggersError } = await supabaseClient
        .from('follow_up_sequence_triggers')
        .select(`
          trigger_tag_id,
          sequence_id,
          follow_up_sequences!inner(id, name, active)
        `)
        .eq('organization_id', org.id)
        .eq('follow_up_sequences.active', true);

      if (triggersError) {
        console.error(`[follow-up-trigger-detector-batch] Error fetching triggers for org ${org.id}:`, triggersError);
        continue;
      }

      if (!activeTriggers || activeTriggers.length === 0) {
        console.log(`[follow-up-trigger-detector-batch] No active triggers found for org ${org.id}`);
        continue;
      }

      console.log(`[follow-up-trigger-detector-batch] Found ${activeTriggers.length} active triggers for org ${org.id}`);

      let processedCount = 0;
      let createdCount = 0;

      // 2. Para cada tag de gatilho, processar chats
      for (const trigger of activeTriggers) {
        console.log(`[follow-up-trigger-detector-batch] Processing trigger tag ${trigger.trigger_tag_id} for sequence ${trigger.sequence_id}`);

        // Buscar chats que têm essa tag de gatilho nesta organização
        const { data: chatsWithTag, error: chatsError } = await supabaseClient
          .from('chat_tags')
          .select('chat_id, organization_id, chats!inner(id, updated_at, organization_id)')
          .eq('tag_id', trigger.trigger_tag_id)
          .eq('organization_id', org.id);

        if (chatsError) {
          console.error(`[follow-up-trigger-detector-batch] Error fetching chats for org ${org.id}:`, chatsError);
          continue;
        }

        if (!chatsWithTag || chatsWithTag.length === 0) {
          console.log(`[follow-up-trigger-detector-batch] No chats with trigger tag ${trigger.trigger_tag_id} for org ${org.id}`);
          continue;
        }

        console.log(`[follow-up-trigger-detector-batch] Found ${chatsWithTag.length} chats with trigger tag for org ${org.id}`);

        // 3. Para cada chat, verificar se já tem tracking ativo OU concluído para esta sequência
        for (const chatTag of chatsWithTag) {
          processedCount++;

          // Verificar se já existe tracking ATIVO para esta sequência
          // Usando .limit(1) ao invés de .maybeSingle() para evitar PGRST116 se houver duplicatas
          const { data: existingTrackings, error: trackingCheckError } = await supabaseClient
            .from('lead_follow_up_tracking')
            .select('id, completed, responded')
            .eq('chat_id', chatTag.chat_id)
            .eq('organization_id', org.id)
            .eq('sequence_id', trigger.sequence_id)
            .eq('completed', false)
            .order('created_at', { ascending: false })
            .limit(1);

          if (trackingCheckError) {
            console.error(`[follow-up-trigger-detector-batch] Error checking tracking for chat ${chatTag.chat_id}:`, trackingCheckError);
            continue;
          }

          // Se já tem tracking ativo, pular (permite reentrar em sequência após completar)
          if (existingTrackings && existingTrackings.length > 0) {
            console.log(`[follow-up-trigger-detector-batch] Chat ${chatTag.chat_id} already has active tracking`);
            continue;
          }

          // 4. Buscar última mensagem válida do lead para determinar o tempo
          const { data: lastLeadMessage } = await supabaseClient
            .from('messages')
            .select('created_at')
            .eq('chat_id', chatTag.chat_id)
            .eq('is_from_user', false) // Mensagem do lead
            .eq('private', false)
            .or('is_follow_up.is.null,is_follow_up.eq.false')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // 5. Criar novo tracking
          console.log(`[follow-up-trigger-detector-batch] Creating tracking for chat ${chatTag.chat_id}`);

          // Buscar primeiro step da sequência
          const { data: firstStep, error: stepError } = await supabaseClient
            .from('follow_up_steps')
            .select('delay_hours')
            .eq('sequence_id', trigger.sequence_id)
            .eq('organization_id', org.id)
            .eq('step_number', 1)
            .single();

          if (stepError || !firstStep) {
            console.error(`[follow-up-trigger-detector-batch] Error fetching first step:`, stepError);
            continue;
          }

          // Calcular next_trigger_at baseado na última mensagem do lead
          const lastMessageAt = lastLeadMessage?.created_at 
            ? new Date(lastLeadMessage.created_at)
            : new Date((chatTag as any).chats.updated_at);
          
          const nextTriggerAt = new Date(lastMessageAt);
          const delayMs = Math.round(Number(firstStep.delay_hours) * 3600000);
          nextTriggerAt.setTime(nextTriggerAt.getTime() + delayMs);

          // Inserir tracking
          const { error: insertError } = await supabaseClient
            .from('lead_follow_up_tracking')
            .insert({
              chat_id: chatTag.chat_id,
              sequence_id: trigger.sequence_id,
              current_step: 1,
              last_message_at: lastMessageAt.toISOString(),
              next_trigger_at: nextTriggerAt.toISOString(),
              organization_id: org.id,
            });

          if (insertError) {
            console.error(`[follow-up-trigger-detector-batch] Error inserting tracking:`, insertError);
            continue;
          }

          createdCount++;
          console.log(`[follow-up-trigger-detector-batch] ✓ Created tracking for chat ${chatTag.chat_id}`);
        }
      }

      totalProcessed += processedCount;
      totalCreated += createdCount;
      console.log(`[follow-up-trigger-detector-batch] Org ${org.id} complete. Processed: ${processedCount}, Created: ${createdCount}`);
    }

    console.log(`[follow-up-trigger-detector-batch] Batch complete. Total Processed: ${totalProcessed}, Total Created: ${totalCreated}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Batch processing complete',
        processed: totalProcessed,
        created: totalCreated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[follow-up-trigger-detector-batch] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
