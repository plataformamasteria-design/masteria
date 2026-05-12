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

import { configureWebhook } from './webhookService.ts';
export async function getInstanceStatus(config: EvolutionApiConfig, instanceName: string) {
  try {
    const response = await fetch(`${config.url}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': config.apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ status: 'not_found', connected: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Connection state:', data);

    // Evolution API returns state: 'open', 'close', 'connecting'
    const isConnected = data.instance?.state === 'open';

    // Fetch extended instance info (phone number, ID, profile pic)
    let ownerJid: string | null = null;
    let phoneNumber: string | null = null;
    let instanceId: string | null = null;
    let profilePicUrl: string | null = null;

    try {
      const infoResp = await fetch(
        `${config.url}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
        { headers: { 'apikey': config.apiKey } }
      );
      if (infoResp.ok) {
        const infoData = await infoResp.json();
        const inst = Array.isArray(infoData) ? infoData[0] : infoData;
        if (inst) {
          ownerJid = inst.ownerJid || null;
          phoneNumber = inst.number || (inst.ownerJid ? inst.ownerJid.split('@')[0] : null);
          instanceId = inst.id || null;
          profilePicUrl = inst.profilePicUrl || null;
        }
      }
    } catch (e) {
      console.log('Could not fetch instance info (non-fatal):', e);
    }

    return new Response(
      JSON.stringify({
        status: data.instance?.state || 'unknown',
        connected: isConnected,
        instance: data.instance,
        ownerJid,
        phoneNumber,
        instanceId,
        profilePicUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error getting status:', error);
    return new Response(
      JSON.stringify({ status: 'error', connected: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function createInstance(
  supabase: any,
  config: EvolutionApiConfig,
  payload: CreateInstancePayload,
  organizationId: string
) {
  try {
    console.log('Creating instance:', payload.instanceName);

    const createPayload: any = {
      instanceName: payload.instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    };

    if (payload.phoneNumber) {
      createPayload.number = payload.phoneNumber.replace(/\D/g, '');
    }

    const doCreate = async () => {
      return await fetch(`${config.url}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey,
        },
        body: JSON.stringify(createPayload),
      });
    };

    let response = await doCreate();

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Create instance error:', errorData);

      // If the name is still in use, it usually means deletion hasn't propagated yet.
      // Try ONE cleanup + wait + retry.
      if (errorData.includes('is already in use')) {
        console.log('Instance name already in use. Trying delete + wait + retry once...');
        try {
          await deleteInstanceFromEvolution(config, payload.instanceName);
        } catch (e) {
          console.log('Delete attempt before retry failed:', e);
        }

        const waitRes = await waitUntilInstanceNotFound(config, payload.instanceName, 15000);
        if (!waitRes.success) {
          throw new Error(`Failed to create instance: ${errorData}`);
        }

        response = await doCreate();
        if (!response.ok) {
          const retryErrorData = await response.text();
          console.error('Create instance retry error:', retryErrorData);
          throw new Error(`Failed to create instance: ${retryErrorData}`);
        }
      } else {
        throw new Error(`Failed to create instance: ${errorData}`);
      }
    }

    const data = await response.json();
    console.log('Instance created:', data);

    // Configure webhook - FAIL if not successful
    const webhookResult = await configureWebhook(config, payload.instanceName, payload.webhookUrl);

    if (!webhookResult.success) {
      console.error('CRITICAL: Webhook configuration failed!');
      // Delete the instance since webhook failed
      try {
        await deleteInstanceFromEvolution(config, payload.instanceName);
      } catch (e) {
        console.log('Failed to cleanup instance after webhook error:', e);
      }

      return new Response(
        JSON.stringify({
          error: 'Falha ao configurar webhook. Verifique a URL e API Key da Evolution.',
          details: webhookResult.error,
          webhookConfigured: false,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save/update connection in database
    const { data: existingConnection } = await supabase
      .from('whatsapp_connections')
      .select('id')
      .eq('instance_name', payload.instanceName)
      .single();

    if (existingConnection) {
      // Update existing
      await supabase
        .from('whatsapp_connections')
        .update({
          phone_number: payload.phoneNumber || null,
          status: 'connecting',
          webhook_url: payload.webhookUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id);
    } else {
      // Insert new (e.g. from legacy components)
      await supabase
        .from('whatsapp_connections')
        .insert({
          organization_id: organizationId,
          instance_name: payload.instanceName,
          phone_number: payload.phoneNumber || null,
          status: 'connecting',
          webhook_url: payload.webhookUrl,
          display_name: payload.instanceName,
          is_default: true,
          updated_at: new Date().toISOString(),
        });
    }

    // Normalize qrcode response
    let qrcode = null;
    if (data.qrcode) {
      qrcode = typeof data.qrcode === 'string' ? data.qrcode : data.qrcode.base64;
    }

    return new Response(
      JSON.stringify({
        success: true,
        instance: data.instance,
        qrcode,
        webhookConfigured: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error creating instance:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function deleteInstance(
  supabase: any,
  config: EvolutionApiConfig,
  instanceName: string,
  organizationId: string
) {
  try {
    await deleteInstanceFromEvolution(config, instanceName);

    // Update database
    await supabase
      .from('whatsapp_connections')
      .update({
        status: 'close',
        updated_at: new Date().toISOString()
      })
      .eq('instance_name', instanceName);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error deleting instance:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function deleteInstanceFromEvolution(config: EvolutionApiConfig, instanceName: string) {
  console.log('Deleting instance from Evolution:', instanceName);

  // First logout (best-effort)
  try {
    await fetch(`${config.url}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: { 'apikey': config.apiKey },
    });
    // Small delay for logout to process
    await new Promise(r => setTimeout(r, 500));
  } catch (e) {
    console.log('Logout failed (instance may not exist):', e);
  }

  // Try to delete with retry logic for 400 errors
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Delete attempt ${attempt}/3...`);

    const response = await fetch(`${config.url}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: { 'apikey': config.apiKey },
    });

    // 200, 201, 404 = success (deleted or doesn't exist)
    if (response.ok || response.status === 404) {
      console.log('Delete instance response status:', response.status);
      return; // Success
    }

    // 400 may mean transient state - retry
    if (response.status === 400) {
      const errorData = await response.text();
      console.log(`Attempt ${attempt} got 400:`, errorData);
      lastError = errorData;

      // Wait before next retry
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000));
      }
      continue;
    }

    // Other errors - fail immediately
    const errorData = await response.text();
    console.error('Delete instance error:', errorData);
    throw new Error(`Delete instance failed: ${response.status} ${errorData}`);
  }

  // If we got here, all attempts failed with 400
  // Check if instance actually still exists
  console.log('All delete attempts failed with 400, checking if instance still exists...');
  const statusCheck = await fetch(`${config.url}/instance/connectionState/${instanceName}`, {
    method: 'GET',
    headers: { 'apikey': config.apiKey },
  });

  // If 404, means it was deleted successfully despite the 400 error
  if (statusCheck.status === 404) {
    console.log('Instance not found after retries - considering deleted');
    return;
  }

  // Instance still exists - fail
  throw new Error(`Delete instance failed after 3 attempts: ${lastError}`);
}

export async function waitUntilInstanceNotFound(
  config: EvolutionApiConfig,
  instanceName: string,
  timeoutMs: number = 15000
): Promise<{ success: boolean; error?: string }> {
  const startedAt = Date.now();
  console.log(`Waiting for instance "${instanceName}" to be not_found (timeout ${timeoutMs}ms)...`);

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const resp = await fetch(`${config.url}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: { 'apikey': config.apiKey },
      });

      if (resp.status === 404) {
        console.log('Instance is not_found. Name is free.');
        return { success: true };
      }

      // If it's any other 2xx/4xx, assume still exists or API doesn't expose 404 yet
      const bodyText = await resp.text();
      console.log('Still not deleted. status=', resp.status, 'body=', bodyText);
    } catch (e) {
      console.log('Error while polling instance status:', e);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return { success: false, error: 'Timeout esperando a instância sumir (nome ainda em uso).' };
}

export async function getConnectionData(config: EvolutionApiConfig, instanceName: string) {
  try {
    console.log('Getting connection data for:', instanceName);

    const response = await fetch(`${config.url}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': config.apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Connect error:', errorData);
      throw new Error(`Failed to get connection: ${errorData}`);
    }

    const data = await response.json();
    console.log('Connection data:', data);

    // Normalize qrcode - can be string or object with base64
    let qrcode = null;
    if (data.base64) {
      qrcode = data.base64;
    } else if (data.qrcode) {
      qrcode = typeof data.qrcode === 'string' ? data.qrcode : data.qrcode.base64;
    }

    return new Response(
      JSON.stringify({
        qrcode,
        pairingCode: data.pairingCode || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error getting connection data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function getPairingCode(config: EvolutionApiConfig, instanceName: string, phoneNumber: string) {
  try {
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required for pairing code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Getting pairing code for:', instanceName);

    const cleanNumber = phoneNumber.replace(/\D/g, '');

    const response = await fetch(`${config.url}/instance/connect/${instanceName}?number=${cleanNumber}`, {
      method: 'GET',
      headers: {
        'apikey': config.apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Pairing code error:', errorData);
      throw new Error(`Failed to get pairing code: ${errorData}`);
    }

    const data = await response.json();
    console.log('Pairing code data:', data);

    // Only return pairingCode - do not fallback to code (which is a long token)
    if (!data.pairingCode) {
      return new Response(
        JSON.stringify({
          error: 'Pairing code not available. Try using QR Code instead.',
          pairingCode: null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        pairingCode: data.pairingCode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error getting pairing code:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

