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
    console.log(`[follow-up-tag-removed] Checking if tag ${tag_id} removal affects chat ${chat_id}, org: ${organization_id || 'not specified'}`);

    // 1. Check if removed tag belongs to any follow-up sequence (scoped by org)
    let stepsQuery = supabase
      .from('follow_up_steps')
      .select('sequence_id, step_number, delay_hours')
      .eq('tag_id', tag_id);

    if (organization_id) {
      stepsQuery = stepsQuery.eq('organization_id', organization_id);
    }

    const { data: stepData } = await stepsQuery;

    if (!stepData || stepData.length === 0) {
      console.log('[follow-up-tag-removed] Tag is not part of any follow-up sequence');
      return new Response(
        JSON.stringify({ message: 'Tag is not part of any follow-up sequence' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. For each sequence that uses this tag
    for (const step of stepData) {
      const { sequence_id, step_number } = step;

      // Check if there's active tracking for this chat + sequence
      const { data: tracking } = await supabase
        .from('lead_follow_up_tracking')
        .select('id, current_step')
        .eq('chat_id', chat_id)
        .eq('sequence_id', sequence_id)
        .eq('completed', false)
        .maybeSingle();

      if (!tracking) {
        console.log(`[follow-up-tag-removed] No active tracking found for sequence ${sequence_id}`);
        continue;
      }

      // 3. Find all tags this chat still has that belong to this sequence
      const { data: remainingSteps } = await supabase
        .from('follow_up_steps')
        .select('step_number, tag_id, delay_hours')
        .eq('sequence_id', sequence_id)
        .order('step_number', { ascending: false });

      if (!remainingSteps) continue;

      // Get all tag_ids from chat_tags for this chat (scoped by org)
      let chatTagsQuery = supabase
        .from('chat_tags')
        .select('tag_id')
        .eq('chat_id', chat_id);

      if (organization_id) {
        chatTagsQuery = chatTagsQuery.eq('organization_id', organization_id);
      }

      const { data: chatTags } = await chatTagsQuery;
      const chatTagIds = chatTags?.map(ct => ct.tag_id) || [];

      // Find the highest step number the chat still has a tag for
      let maxStepWithTag = 0;
      for (const rs of remainingSteps) {
        if (chatTagIds.includes(rs.tag_id)) {
          maxStepWithTag = rs.step_number;
          break; // Since it's ordered DESC, first match is the highest
        }
      }

      // 4. Determine next step to send
      const nextStep = maxStepWithTag + 1;

      // Get delay for next step
      const nextStepData = remainingSteps.find(rs => rs.step_number === nextStep);
      
      if (!nextStepData) {
        console.log(`[follow-up-tag-removed] No next step found, marking as completed`);
        await supabase
          .from('lead_follow_up_tracking')
          .update({ completed: true })
          .eq('id', tracking.id);
        continue;
      }

      // 5. Reset tracking to next step
      const nextTrigger = new Date();
      const delayMs = Math.round(Number(nextStepData.delay_hours) * 3600000);
      nextTrigger.setTime(nextTrigger.getTime() + delayMs);

      await supabase
        .from('lead_follow_up_tracking')
        .update({
          current_step: nextStep,
          next_trigger_at: nextTrigger.toISOString(),
          responded: false,
          completed: false,
          last_sent_at: null,
        })
        .eq('id', tracking.id);

      console.log(`[follow-up-tag-removed] Reset tracking for chat ${chat_id} to step ${nextStep}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Tracking updated based on remaining tags' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[follow-up-tag-removed] Error:', error);
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