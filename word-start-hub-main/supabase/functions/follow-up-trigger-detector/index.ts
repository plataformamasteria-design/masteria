import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { chat_id, tag_id, organization_id } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[follow-up-trigger-detector] Checking if tag ${tag_id} triggers any sequence for chat ${chat_id} in org ${organization_id}`);

    // Check if this tag triggers any active sequence for this organization
    const { data: triggers, error: triggerError } = await supabase
      .from('follow_up_sequence_triggers')
      .select('sequence_id, follow_up_sequences!inner(id, name, active)')
      .eq('trigger_tag_id', tag_id)
      .eq('organization_id', organization_id);

    if (triggerError) {
      console.error('[follow-up-trigger-detector] Error fetching triggers:', triggerError);
      throw triggerError;
    }

    console.log(`[follow-up-trigger-detector] Found ${triggers?.length || 0} trigger(s) for this tag`);

    if (!triggers || triggers.length === 0) {
      console.log('[follow-up-trigger-detector] No sequences triggered by this tag');
      return new Response(
        JSON.stringify({ success: true, triggered: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter for active sequences
    const activeSequences = triggers.filter(t => {
      const seq = t.follow_up_sequences as any;
      return seq && seq.active === true;
    });

    console.log(`[follow-up-trigger-detector] Found ${activeSequences.length} active sequence(s)`);

    if (activeSequences.length === 0) {
      console.log('[follow-up-trigger-detector] No active sequences triggered by this tag');
      return new Response(
        JSON.stringify({ success: true, triggered: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sequencesActivated = 0;

    for (const trigger of activeSequences) {
      const sequenceId = trigger.sequence_id;

      // Check if lead already has active tracking for this sequence
      const { data: existingTracking } = await supabase
        .from('lead_follow_up_tracking')
        .select('*')
        .eq('chat_id', chat_id)
        .eq('organization_id', organization_id)
        .eq('sequence_id', sequenceId)
        .eq('completed', false)
        .maybeSingle();

      if (existingTracking) {
        console.log(`[follow-up-trigger-detector] Lead already has active tracking for sequence ${sequenceId}`);
        continue;
      }

      // Get the first step to calculate initial delay
      const { data: firstStep } = await supabase
        .from('follow_up_steps')
        .select('delay_hours')
        .eq('sequence_id', sequenceId)
        .eq('organization_id', organization_id)
        .eq('step_number', 1)
        .single();

      if (!firstStep) {
        console.log(`[follow-up-trigger-detector] No steps found for sequence ${sequenceId}`);
        continue;
      }

      // Get chat's last message time and organization
      const { data: chat } = await supabase
        .from('chats')
        .select('updated_at, organization_id')
        .eq('id', chat_id)
        .eq('organization_id', organization_id)
        .single();

      if (!chat) {
        console.log(`[follow-up-trigger-detector] Chat not found: ${chat_id}`);
        continue;
      }

      // Validate organization match
      if (chat.organization_id !== organization_id) {
        console.error(`[follow-up-trigger-detector] Organization mismatch for chat ${chat_id}`);
        continue;
      }

      // Calculate next trigger time based on last message + first step delay
      const lastMessageAt = new Date(chat.updated_at);
      const nextTriggerAt = new Date(lastMessageAt);
      const delayMs = Math.round(Number(firstStep.delay_hours) * 3600000);
      nextTriggerAt.setTime(nextTriggerAt.getTime() + delayMs);

      console.log(`[follow-up-trigger-detector] Creating tracking: last_message=${lastMessageAt.toISOString()}, next_trigger=${nextTriggerAt.toISOString()}, delay=${firstStep.delay_hours}h`);

      // Create tracking record
      const { error: trackingError } = await supabase
        .from('lead_follow_up_tracking')
        .insert({
          chat_id,
          sequence_id: sequenceId,
          current_step: 1,
          last_message_at: lastMessageAt.toISOString(),
          next_trigger_at: nextTriggerAt.toISOString(),
          organization_id: chat.organization_id,
        });

      if (trackingError) {
        console.error('[follow-up-trigger-detector] Error creating tracking:', trackingError);
        continue;
      }

      sequencesActivated++;
      console.log(`[follow-up-trigger-detector] ✓ Created tracking for sequence ${sequenceId}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        triggered: sequencesActivated > 0,
        sequences_activated: sequencesActivated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[follow-up-trigger-detector] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
