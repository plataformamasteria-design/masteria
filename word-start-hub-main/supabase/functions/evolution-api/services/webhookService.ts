import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EvolutionApiConfig {
  url: string;
  apiKey: string;
}

interface CreateInstancePayload {
  instanceName: string;
  phoneNumber?: string;
  webhookUrl: string;
}

type CreateGroupPayload = {
  subject: string;
  description?: string;
  participants?: string[];
};

export async function configureWebhook(
  config: EvolutionApiConfig,
  instanceName: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  console.log('=== CONFIGURING WEBHOOK ===');
  console.log('Instance:', instanceName);
  console.log('URL:', webhookUrl);

  // IMPORTANT:
  // Some Evolution builds validate events against a strict enum.
  // If we include unknown values (e.g. dot-notation like MESSAGES.UPDATE), the request is rejected.
  // We'll try a couple of event sets.
  const eventSets: Array<{ name: string; events: string[] }> = [
    {
      name: 'underscore_with_groups',
      // This matches the enum we saw in the API error payload.
      // Include MESSAGES_EDITED since some builds use it for message edits.
      // Group events are required to keep group metadata in sync.
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'MESSAGES_DELETE',
        'MESSAGES_EDITED',
        'GROUPS_UPSERT',
        'GROUP_UPDATE',
        'GROUP_PARTICIPANTS_UPDATE',
      ],
    },
    {
      // Fallback in case the Evolution build doesn't recognize group-related events.
      name: 'underscore_messages_only',
      events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'MESSAGES_EDITED'],
    },
    {
      name: 'dot',
      events: ['MESSAGES.UPSERT', 'MESSAGES.UPDATE', 'MESSAGES.DELETE'],
    },
  ];

  const buildAttempts = (events: string[]): Array<{ name: string; payload: Record<string, unknown> }> => [
    // Prefer the documented v2 keys first.
    {
      name: 'nested_v2',
      payload: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: true,
          base64: true,
          hashB64: true,
          events,
        },
      },
    },
    {
      name: 'flat_v2',
      payload: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        base64: true,
        hashB64: true,
        events,
      },
    },
    // Fallback older key names
    {
      name: 'nested_v1',
      payload: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events,
        },
      },
    },
    {
      name: 'flat_v1',
      payload: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events,
      },
    },
    // Some builds validate the payload as { instance: { webhook: ... } }
    // (kept as last resort).
    {
      name: 'instance_nested_v2',
      payload: {
        instance: {
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: true,
            events,
          },
        },
      },
    },
  ];

  let lastError = 'Unknown error';

  const postWebhookConfig = async (endpointUrl: string, attemptName: string, payload: Record<string, unknown>) => {
    console.log(`Webhook endpoint: ${endpointUrl}`);
    console.log(`Webhook attempt: ${attemptName}`);
    console.log('Webhook payload:', JSON.stringify(payload));

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`${attemptName} status:`, response.status);
    console.log(`${attemptName} body:`, responseText);

    return { response, responseText };
  };

  for (const set of eventSets) {
    console.log(`Trying webhook event set: ${set.name}`);
    const attempts = buildAttempts(set.events);

    for (const attempt of attempts) {
      try {
        const endpointUrl = `${config.url}/webhook/set/${encodeURIComponent(instanceName)}`;
        const attemptName = `${set.name}::${attempt.name}`;
        const { response, responseText } = await postWebhookConfig(endpointUrl, attemptName, attempt.payload);

        if (!response.ok) {
          lastError = responseText;
          continue;
        }

        // Wait a moment for webhook to be applied
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify webhook was actually configured
        const verified = await verifyWebhookConfig(config, instanceName, webhookUrl, set.events);
        if (verified.success) {
          console.log('=== WEBHOOK CONFIGURED AND VERIFIED ===');
          return { success: true };
        }

        lastError = `Verification failed after ${attemptName}: ${verified.error}`;
      } catch (e) {
        lastError = String(e);
      }
    }
  }

  const primaryLastError = lastError;

  // Fallback: some deployments use /webhook/set (no instance in path)
  // and require instanceName / instance.webhook inside the body.
  console.log('Primary webhook endpoint failed. Trying fallback endpoint /webhook/set...');

  // Use the most compatible (underscore) event set for fallback.
  const fallbackEvents = eventSets[0]?.events ?? ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'MESSAGES_EDITED'];

  const v2Webhook = {
    enabled: true,
    url: webhookUrl,
    webhookByEvents: false,
    webhookBase64: true,
    events: fallbackEvents,
  };

  const fallbackAttempts: Array<{ name: string; payload: Record<string, unknown> }> = [
    {
      name: 'no_path_flat_v2_instanceName',
      payload: {
        instanceName,
        ...v2Webhook,
      },
    },
    {
      name: 'no_path_nested_webhook_v2_instanceName',
      payload: {
        instanceName,
        webhook: v2Webhook,
      },
    },
    {
      name: 'no_path_instance_object_webhook_v2',
      payload: {
        instance: {
          instanceName,
          webhook: v2Webhook,
        },
      },
    },
    {
      name: 'no_path_instance_object_plus_webhook_v2',
      payload: {
        instance: {
          instanceName,
        },
        webhook: v2Webhook,
      },
    },
  ];

  for (const attempt of fallbackAttempts) {
    try {
      const endpointUrl = `${config.url}/webhook/set`;
      const { response, responseText } = await postWebhookConfig(endpointUrl, attempt.name, attempt.payload);

      if (!response.ok) {
        lastError = responseText;
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      const verified = await verifyWebhookConfig(config, instanceName, webhookUrl, fallbackEvents);
      if (verified.success) {
        console.log('=== WEBHOOK CONFIGURED AND VERIFIED (FALLBACK) ===');
        return { success: true };
      }

      lastError = `Verification failed after ${attempt.name}: ${verified.error}`;
    } catch (e) {
      lastError = String(e);
    }
  }

  // If the fallback endpoint doesn't exist, do not mask the primary error.
  if (String(lastError).includes('Cannot POST /webhook/set')) {
    lastError = primaryLastError;
  }

  return { success: false, error: `Webhook config failed: ${lastError}` };
}

export async function verifyWebhookConfig(
  config: EvolutionApiConfig,
  instanceName: string,
  expectedUrl: string,
  requiredEvents: string[] = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'MESSAGES_DELETE']
): Promise<{ success: boolean; error?: string }> {
  console.log('Verifying webhook configuration...');

  // Try different endpoints to get webhook config
  const endpoints = [
    `${config.url}/webhook/find/${instanceName}`,
    `${config.url}/webhook/${instanceName}`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log('Checking webhook at:', endpoint);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'apikey': config.apiKey },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Webhook config from API:', JSON.stringify(data));

        // Check if webhook is properly configured
        // Handle different response formats
        const webhookConfig = data.webhook || data.instance?.webhook || data;
        const isEnabled = webhookConfig.enabled === true;
        const hasCorrectUrl = webhookConfig.url === expectedUrl;
        const eventsList = Array.isArray(webhookConfig.events) ? webhookConfig.events : [];
        const hasMessagesUpsert = eventsList.includes('MESSAGES_UPSERT') || eventsList.includes('MESSAGES.UPSERT');
        const hasMessagesUpdate = eventsList.includes('MESSAGES_UPDATE') || eventsList.includes('MESSAGES.UPDATE');
        const hasMessagesDelete = eventsList.includes('MESSAGES_DELETE') || eventsList.includes('MESSAGES.DELETE');

        // Validate required events list when provided (best-effort: accept dot-notation for message events)
        const missingRequired = (requiredEvents || []).filter((evt) => {
          if (evt === 'MESSAGES_UPSERT') return !(eventsList.includes('MESSAGES_UPSERT') || eventsList.includes('MESSAGES.UPSERT'));
          if (evt === 'MESSAGES_UPDATE') return !(eventsList.includes('MESSAGES_UPDATE') || eventsList.includes('MESSAGES.UPDATE'));
          if (evt === 'MESSAGES_DELETE') return !(eventsList.includes('MESSAGES_DELETE') || eventsList.includes('MESSAGES.DELETE'));
          return !eventsList.includes(evt);
        });

        console.log('Verification results:');
        console.log('  - enabled:', isEnabled, '(expected: true)');
        console.log('  - url:', webhookConfig.url, '(expected:', expectedUrl, ')');
        console.log('  - hasMessagesUpsert:', hasMessagesUpsert);
        console.log('  - hasMessagesUpdate:', hasMessagesUpdate);
        console.log('  - hasMessagesDelete:', hasMessagesDelete);

        if (
          isEnabled &&
          hasCorrectUrl &&
          hasMessagesUpsert &&
          hasMessagesUpdate &&
          hasMessagesDelete &&
          missingRequired.length === 0
        ) {
          return { success: true };
        } else {
          const issues = [];
          if (!isEnabled) issues.push('webhook not enabled');
          if (!hasCorrectUrl) issues.push(`wrong URL: ${webhookConfig.url}`);
          if (!hasMessagesUpsert) issues.push('MESSAGES_UPSERT not in events');
          if (!hasMessagesUpdate) issues.push('MESSAGES_UPDATE not in events');
          if (!hasMessagesDelete) issues.push('MESSAGES_DELETE not in events');
          if (missingRequired.length) issues.push(`missing required events: ${missingRequired.join(', ')}`);
          return { success: false, error: `Webhook misconfigured: ${issues.join(', ')}` };
        }
      }
    } catch (e) {
      console.log('Failed to check endpoint:', endpoint, e);
    }
  }

  // If no verification endpoint worked, assume success (some Evolution versions don't have GET endpoint)
  console.log('Could not verify webhook (no GET endpoint available), assuming success');
  return { success: true };
}

export async function updateInstanceWebhook(
  supabase: any,
  config: EvolutionApiConfig,
  instanceName: string,
  webhookUrl: string,
  organizationId: string
): Promise<Response> {
  console.log('=== UPDATING WEBHOOK FOR EXISTING INSTANCE ===');
  console.log('Instance:', instanceName);
  console.log('New URL:', webhookUrl);

  try {
    // First check if instance exists
    const statusResponse = await fetch(`${config.url}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': config.apiKey },
    });

    if (statusResponse.status === 404) {
      return new Response(
        JSON.stringify({ error: 'Instância não encontrada. Crie uma nova conexão.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configure webhook
    const webhookResult = await configureWebhook(config, instanceName, webhookUrl);

    if (!webhookResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Falha ao atualizar webhook',
          details: webhookResult.error,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update database
    await supabase
      .from('whatsapp_connections')
      .update({
        webhook_url: webhookUrl,
        updated_at: new Date().toISOString()
      })
      .eq('instance_name', instanceName);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook atualizado com sucesso',
        webhookUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error updating webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function getInstanceWebhook(
  config: EvolutionApiConfig,
  instanceName: string
): Promise<Response> {
  console.log('Getting webhook config for:', instanceName);

  try {
    // Try different endpoints
    const endpoints = [
      `${config.url}/webhook/find/${instanceName}`,
      `${config.url}/webhook/${instanceName}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'apikey': config.apiKey },
        });

        if (response.ok) {
          const data = await response.json();
          const webhookConfig = data.webhook || data.instance?.webhook || data;

          return new Response(
            JSON.stringify({
              enabled: webhookConfig.enabled,
              url: webhookConfig.url,
              events: webhookConfig.events,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.log('Failed to check endpoint:', endpoint, e);
      }
    }

    return new Response(
      JSON.stringify({ error: 'Não foi possível obter configuração do webhook' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error getting webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

