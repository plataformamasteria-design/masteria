import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

async function getEvolutionConfig(
  supabase: any,
  organizationId: string,
  overrideInstanceName?: string | null
): Promise<EvolutionConfig | null> {
  // Fetch organization details
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('slug, instance_name, evolution_api_url, evolution_api_key')
    .eq('id', organizationId)
    .single();

  if (orgError || !org) {
    console.error('[scheduled-message-processor] Organization not found:', orgError);
    return null;
  }

  // Always fetch global config (same as send-to-evolution)
  const { data: globalConfig, error: configError } = await supabase
    .from('global_config')
    .select('key, value')
    .in('key', ['evolution_api_url', 'evolution_api_key']);

  if (configError) {
    console.error('[scheduled-message-processor] Error fetching global config:', configError);
    return null;
  }

  const globalEvolutionUrl = globalConfig?.find((c: any) => c.key === 'evolution_api_url')?.value;
  const globalEvolutionKey = globalConfig?.find((c: any) => c.key === 'evolution_api_key')?.value;

  // Helper function to validate if a value looks like an API key (not a URL)
  const isValidApiKey = (value: string | null): boolean => {
    if (!value) return false;
    return !value.includes('http://') && !value.includes('https://') && value.length > 10;
  };

  // Helper function to validate if a value looks like a URL
  const isValidUrl = (value: string | null): boolean => {
    if (!value) return false;
    return value.startsWith('http://') || value.startsWith('https://');
  };

  // Determine the correct URL (org takes priority, fallback to global)
  let apiUrl: string | null = null;
  if (isValidUrl(org.evolution_api_url)) {
    apiUrl = org.evolution_api_url;
  } else if (isValidUrl(globalEvolutionUrl)) {
    apiUrl = globalEvolutionUrl;
  }

  // Determine the correct API key (org takes priority, fallback to global)
  let apiKey: string | null = null;
  if (isValidApiKey(org.evolution_api_key)) {
    apiKey = org.evolution_api_key;
  } else if (isValidApiKey(globalEvolutionKey)) {
    apiKey = globalEvolutionKey;
  }

  console.log(`[scheduled-message-processor] Evolution config for org ${org.slug}: URL=${apiUrl ? 'found' : 'missing'}, Key=${apiKey ? 'found' : 'missing'}`);

  if (!apiUrl || !apiKey) {
    console.error('[scheduled-message-processor] Evolution API not configured properly');
    return null;
  }

  // Clean the URL - remove trailing slashes and /manager or /api suffixes
  let cleanUrl = apiUrl.replace(/\/$/, '');
  cleanUrl = cleanUrl.replace(/\/manager\/?$/, '');
  cleanUrl = cleanUrl.replace(/\/api\/?$/, '');

  // Use overrideInstanceName if set, otherwise fallback to org.instance_name or slug
  const instanceName = overrideInstanceName || org.instance_name || org.slug;

  console.log(`[scheduled-message-processor] Using Evolution instance: ${instanceName}`);

  return { apiUrl: cleanUrl, apiKey, instanceName };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[scheduled-message-processor] Starting processing...');

    // Fetch pending scheduled messages that are due
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select(`
        id,
        organization_id,
        chat_id,
        content,
        message_type,
        file_url,
        file_name,
        scheduled_for,
        created_by
      `)
      .lte('scheduled_for', now)
      .is('sent_at', null)
      .is('cancelled_at', null)
      .limit(50);

    if (fetchError) {
      console.error('[scheduled-message-processor] Error fetching messages:', fetchError);
      throw fetchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[scheduled-message-processor] No pending messages found');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[scheduled-message-processor] Found ${pendingMessages.length} pending messages`);

    let processed = 0;
    let errors = 0;

    for (const msg of pendingMessages) {
      try {
        console.log(`[scheduled-message-processor] Processing message ${msg.id} for chat ${msg.chat_id}`);

        // Get chat details
        const { data: chat, error: chatError } = await supabase
          .from('chats')
          .select('phone, channel, organization_id')
          .eq('id', msg.chat_id)
          .single();

        if (chatError || !chat) {
          console.error(`[scheduled-message-processor] Chat not found for message ${msg.id}`);
          await supabase
            .from('scheduled_messages')
            .update({ 
              error_message: 'Chat não encontrado',
              updated_at: new Date().toISOString()
            })
            .eq('id', msg.id);
          errors++;
          continue;
        }

        // Get Evolution API config with global fallback
        const evolutionConfig = await getEvolutionConfig(supabase, msg.organization_id, chat.channel);

        if (!evolutionConfig) {
          const errorMsg = 'WhatsApp não configurado: URL/KEY ou instância ausentes';
          console.error(`[scheduled-message-processor] ${errorMsg} for org ${msg.organization_id}`);
          await supabase
            .from('scheduled_messages')
            .update({ 
              error_message: errorMsg,
              updated_at: new Date().toISOString()
            })
            .eq('id', msg.id);
          errors++;
          continue;
        }

        // Use phone directly like send-to-evolution does
        const phoneNumber = chat.phone;

        // Send message via Evolution API
        const evolutionUrl = `${evolutionConfig.apiUrl}/message/sendText/${evolutionConfig.instanceName}`;
        
        console.log(`[scheduled-message-processor] Sending to ${evolutionUrl} - phone: ${phoneNumber}`);

        const sendResponse = await fetch(evolutionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionConfig.apiKey,
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: msg.content,
          }),
        });

        const responseText = await sendResponse.text();
        let sendResult: any = null;
        
        try {
          sendResult = JSON.parse(responseText);
        } catch {
          sendResult = { raw: responseText };
        }

        if (!sendResponse.ok) {
          const errorMsg = `Erro ao enviar (HTTP ${sendResponse.status}): ${responseText.substring(0, 200)}`;
          console.error(`[scheduled-message-processor] Evolution API error for message ${msg.id}:`, errorMsg);
          await supabase
            .from('scheduled_messages')
            .update({ 
              error_message: errorMsg,
              updated_at: new Date().toISOString()
            })
            .eq('id', msg.id);
          errors++;
          continue;
        }

        console.log(`[scheduled-message-processor] Message ${msg.id} sent successfully:`, sendResult);

        // Create message record
        const externalMessageId = sendResult?.key?.id || null;
        
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            organization_id: msg.organization_id,
            chat_id: msg.chat_id,
            content: msg.content,
            message_type: msg.message_type || 'text',
            is_from_user: true,
            sent_from_platform: true,
            sent_by: msg.created_by,
            external_message_id: externalMessageId,
            file_url: msg.file_url,
            file_name: msg.file_name,
          });

        if (insertError) {
          console.error(`[scheduled-message-processor] Error inserting message for ${msg.id}:`, insertError);
        } else {
          console.log(`[scheduled-message-processor] Message record created for scheduled message ${msg.id}`);
        }

        // Update chat
        await supabase
          .from('chats')
          .update({
            last_message: msg.content,
            last_message_at: new Date().toISOString(),
            last_read_at: new Date().toISOString(),
          })
          .eq('id', msg.chat_id);

        // Mark as sent
        await supabase
          .from('scheduled_messages')
          .update({ 
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', msg.id);

        processed++;
      } catch (msgError) {
        const errorMsg = String(msgError).substring(0, 500);
        console.error(`[scheduled-message-processor] Error processing message ${msg.id}:`, msgError);
        await supabase
          .from('scheduled_messages')
          .update({ 
            error_message: errorMsg,
            updated_at: new Date().toISOString()
          })
          .eq('id', msg.id);
        errors++;
      }
    }

    console.log(`[scheduled-message-processor] Completed. Processed: ${processed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ success: true, processed, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[scheduled-message-processor] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
