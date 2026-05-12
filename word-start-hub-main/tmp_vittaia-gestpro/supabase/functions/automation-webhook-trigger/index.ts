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
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token de webhook não fornecido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Find automation by webhook_token
    const { data: automation, error: findError } = await supabaseAdmin
      .from('automations')
      .select('id, organization_id, status, trigger_type')
      .eq('webhook_token', token)
      .eq('trigger_type', 'webhook')
      .single();

    if (findError || !automation) {
      return new Response(
        JSON.stringify({ error: 'Automação não encontrada para este token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (automation.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Automação não está ativa', automation_id: automation.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Parse request body
    let webhookData = {};
    try {
      webhookData = await req.json();
    } catch {
      // No body or invalid JSON - continue with empty data
    }

    console.log('Webhook trigger received for automation:', automation.id, 'data:', JSON.stringify(webhookData));

    // Call the automation executor with webhook context
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const execResponse = await fetch(`${supabaseUrl}/functions/v1/automation-executor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        trigger_type: 'webhook',
        automation_id: automation.id,
        organization_id: automation.organization_id,
        webhook_data: webhookData,
      }),
    });

    const execResult = await execResponse.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Automação disparada com sucesso',
        automation_id: automation.id,
        execution: execResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Erro no webhook trigger:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
