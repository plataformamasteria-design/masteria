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

import { requireAdminCallerUserId } from './utils/helpers.ts';
import { getInstanceStatus, createInstance, deleteInstance, deleteInstanceFromEvolution, waitUntilInstanceNotFound, getConnectionData, getPairingCode } from './services/instanceService.ts';
import { updateInstanceWebhook, getInstanceWebhook } from './services/webhookService.ts';
import { createWhatsAppGroup, updateGroupParticipants, getGroupInviteCode, updateGroupPicture, fetchGroupInfoFromEvolution, syncGroupParticipantsSnapshot, enrichGroupParticipants } from './services/groupService.ts';
import { ensureLeadFromPhone, validateWhatsAppNumber, sendTextMessage } from './services/messagingService.ts';
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    // NOTE: supabase.functions.invoke doesn't always pass query params consistently across environments.
    // To be robust, we accept both query-string AND body fields.
    // IMPORTANT: Request bodies can be read only once. So we parse it here and reuse everywhere.
    let bodyForRouting: any = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        bodyForRouting = await req.json();
      } catch {
        bodyForRouting = null;
      }
    }

    const action = url.searchParams.get('action') || bodyForRouting?.action;
    const organizationId = url.searchParams.get('organization_id') || bodyForRouting?.organization_id;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get global Evolution API config
    const { data: globalConfig, error: configError } = await supabase
      .from('global_config')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_webhook_url']);

    if (configError) {
      console.error('Error fetching global config:', configError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch global configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const globalEvolutionUrl = globalConfig?.find((c: any) => c.key === 'evolution_api_url')?.value;
    const globalEvolutionKey = globalConfig?.find((c: any) => c.key === 'evolution_api_key')?.value;
    const globalWebhookUrlTemplate = globalConfig?.find((c: any) => c.key === 'evolution_webhook_url')?.value;

    if (!globalEvolutionUrl || !globalEvolutionKey) {
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured globally. Please configure it in the Organizations page.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization slug and instance_name
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('slug, instance_name')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      console.error('Organization not found:', orgError);
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the URL - remove trailing slash and any path segments like /manager
    let cleanUrl = globalEvolutionUrl.replace(/\/$/, '');
    cleanUrl = cleanUrl.replace(/\/manager\/?$/, '');
    cleanUrl = cleanUrl.replace(/\/api\/?$/, '');

    const evolutionConfig: EvolutionApiConfig = {
      url: cleanUrl,
      apiKey: globalEvolutionKey,
    };

    // Use instance_name if set, otherwise fallback to slug
    // Support override_instance_name for multi-connection scenarios
    const overrideInstanceName = bodyForRouting?.override_instance_name;
    const instanceName = overrideInstanceName || org.instance_name || org.slug;

    // Build webhook URL from template or use the new native receiver
    // Default to the native evolution-webhook-receiver function
    const defaultWebhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook-receiver?instance=${instanceName}&organization_id=${organizationId}`;
    const webhookUrlTemplate = globalWebhookUrlTemplate || defaultWebhookUrl;
    const webhookUrl = webhookUrlTemplate
      .replace('{instance}', instanceName)
      .replace('{{instance}}', instanceName)
      .replace('[nome da instancia criada]', instanceName);

    console.log(`Processing action: ${action} for instance: ${instanceName}`);
    console.log(`Evolution API URL: ${evolutionConfig.url}`);
    console.log(`Webhook URL: ${webhookUrl}`);
    console.log(`API Key present: ${evolutionConfig.apiKey ? 'Yes (length: ' + evolutionConfig.apiKey.length + ')' : 'No'}`);

    switch (action) {
      case 'status': {
        return await getInstanceStatus(evolutionConfig, instanceName);
      }

      case 'create': {
        const body = bodyForRouting || {};
        const payload: CreateInstancePayload = {
          instanceName,
          phoneNumber: body.phoneNumber,
          webhookUrl,
        };
        return await createInstance(supabase, evolutionConfig, payload, organizationId);
      }

      case 'delete': {
        return await deleteInstance(supabase, evolutionConfig, instanceName, organizationId);
      }

      case 'connect': {
        return await getConnectionData(evolutionConfig, instanceName);
      }

      case 'reconnect': {
        // Instead of fully deleting the instance and suffering timeouts, 
        // we can simply logout the socket and request a fresh QR code from Evolution API.

        console.log('Reconnect: Logging out existing WhatsApp session forcefully...');
        try {
          await fetch(`${evolutionConfig.url}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: { 'apikey': evolutionConfig.apiKey },
          });
        } catch (e) {
          console.log('Logout attempt failed:', e);
        }

        // Wait a tiny bit (1 sec) for Evolution WebSocket to really shut down the session
        await new Promise(r => setTimeout(r, 1000));

        // Now just get the connect QR code (this does not touch webhooks or config)
        console.log('Generating fresh QR Code for instance...');
        return await getConnectionData(evolutionConfig, instanceName);
      }

      case 'pairing-code': {
        const body = bodyForRouting || {};
        return await getPairingCode(evolutionConfig, instanceName, body.phoneNumber);
      }

      case 'update-webhook': {
        return await updateInstanceWebhook(supabase, evolutionConfig, instanceName, webhookUrl, organizationId);
      }

      case 'get-webhook': {
        return await getInstanceWebhook(evolutionConfig, instanceName);
      }

      case 'validate-number': {
        const body = bodyForRouting || {};
        return await validateWhatsAppNumber(evolutionConfig, instanceName, body.numbers);
      }

      case 'ensure-lead-from-phone': {
        const body = bodyForRouting || {};
        const phone = String(body.phone || body.phoneDigits || body.number || '').replace(/\D/g, '');
        const pushName = body.pushName ? String(body.pushName) : null;
        if (!phone || phone.length < 8) {
          return new Response(JSON.stringify({ error: 'phone is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return await ensureLeadFromPhone({
          supabase,
          evolutionConfig,
          instanceName,
          organizationId,
          phone,
          pushName,
        });
      }

      case 'send-text': {
        const body = bodyForRouting || {};
        return await sendTextMessage(evolutionConfig, instanceName, body.number, body.text);
      }

      case 'create-group': {
        // Require authenticated user and admin-level role
        const callerUserId = await requireAdminCallerUserId(supabase, req);
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = (bodyForRouting || {}) as CreateGroupPayload;
        if (!body?.subject || !String(body.subject).trim()) {
          return new Response(JSON.stringify({ error: 'subject is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Ensure webhook is updated BEFORE group creation, including group-related events.
        const webhookUpdate = await updateInstanceWebhook(
          supabase,
          evolutionConfig,
          instanceName,
          webhookUrl,
          organizationId
        );
        if (!webhookUpdate.ok) return webhookUpdate;

        let participants = Array.isArray(body.participants) ? body.participants : [];

        // Evolution v2 commonly requires at least 1 participant.
        // Since the UI can request "criar sem participantes", we will try to fallback
        // to the instance's own phone number (when stored) to satisfy the minimum.
        if (!participants.length) {
          const { data: conn } = await supabase
            .from('whatsapp_connections')
            .select('phone_number')
            .eq('organization_id', organizationId)
            .maybeSingle();

          const selfNumber = conn?.phone_number ? String(conn.phone_number).replace(/\D/g, '') : '';
          if (selfNumber.length >= 10) {
            participants = [selfNumber];
            console.log('[create-group] Using instance phone_number as fallback participant');
          } else {
            return new Response(
              JSON.stringify({
                error: 'participants_required',
                message:
                  'A Evolution exige pelo menos 1 participante para criar um grupo. Não foi possível detectar o número da instância (phone_number).',
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return await createWhatsAppGroup(evolutionConfig, instanceName, {
          subject: String(body.subject).trim(),
          description: body.description ? String(body.description) : undefined,
          participants,
        });
      }

      case 'group-update-participants': {
        const callerUserId = await requireAdminCallerUserId(supabase, req);
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = bodyForRouting || {};
        const groupJid = String(body.groupJid || '').trim();
        const operation = String(body.operation || '').trim();
        const participantsRaw = Array.isArray(body.participants) ? body.participants : [];

        if (!groupJid || !groupJid.includes('@g.us')) {
          return new Response(JSON.stringify({ error: 'groupJid is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (!['add', 'remove', 'promote', 'demote'].includes(operation)) {
          return new Response(JSON.stringify({ error: 'invalid operation' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const participants = participantsRaw
          .map((p: any) => String(p || '').split('@')[0].replace(/\D/g, ''))
          .filter((p: string) => p.length >= 8);

        if (!participants.length) {
          return new Response(JSON.stringify({ error: 'participants_required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return await updateGroupParticipants(evolutionConfig, instanceName, groupJid, operation as any, participants);
      }

      case 'group-invite': {
        const callerUserId = await requireAdminCallerUserId(supabase, req);
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = bodyForRouting || {};
        const groupJid = String(body.groupJid || '').trim();
        if (!groupJid || !groupJid.includes('@g.us')) {
          return new Response(JSON.stringify({ error: 'groupJid is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return await getGroupInviteCode(evolutionConfig, instanceName, groupJid);
      }

      case 'group-update-picture': {
        const callerUserId = await requireAdminCallerUserId(supabase, req);
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = bodyForRouting || {};
        const groupJid = String(body.groupJid || '').trim();
        const pictureUrl = String(body.pictureUrl || '').trim();
        if (!groupJid || !groupJid.includes('@g.us')) {
          return new Response(JSON.stringify({ error: 'groupJid is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (!pictureUrl) {
          return new Response(JSON.stringify({ error: 'pictureUrl is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return await updateGroupPicture(evolutionConfig, instanceName, groupJid, pictureUrl);
      }

      case 'group-info': {
        const callerUserId = await requireAdminCallerUserId(supabase, req);
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = bodyForRouting || {};
        const groupJid = String(body.groupJid || '').trim();
        if (!groupJid || !groupJid.includes('@g.us')) {
          return new Response(JSON.stringify({ error: 'groupJid is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Ensure the group chat exists in our DB (needed to store participants)
        const { data: chatRow, error: chatErr } = await supabase
          .from('chats')
          .select('id, phone, group_name, participant_count')
          .eq('organization_id', organizationId)
          .eq('phone', groupJid)
          .maybeSingle();
        if (chatErr) {
          return new Response(JSON.stringify({ error: 'Failed to load chat', details: chatErr.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (!chatRow?.id) {
          return new Response(JSON.stringify({ error: 'group_not_found', message: 'Grupo ainda não existe na plataforma.' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const groupInfo = await fetchGroupInfoFromEvolution(evolutionConfig, instanceName, groupJid);
        if (!groupInfo) {
          return new Response(JSON.stringify({ error: 'Falha ao buscar informações do grupo' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Sync participants snapshot
        const instanceIsAdmin = await syncGroupParticipantsSnapshot({
          supabase,
          organizationId,
          groupChatId: String(chatRow.id),
          groupJid,
          groupInfo,
        });

        // Keep chat metadata updated
        try {
          const subject = String((groupInfo as any)?.subject || '').trim();
          const size = (groupInfo as any)?.size;
          const patch: any = {};
          if (subject) patch.group_name = subject;
          if (typeof size === 'number') patch.participant_count = size;
          if (Object.keys(patch).length) {
            await supabase
              .from('chats')
              .update(patch)
              .eq('id', chatRow.id)
              .eq('organization_id', organizationId);
          }
        } catch (e) {
          console.log('[group-info] chat update failed (non-fatal):', e);
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              groupInfo,
              instanceIsAdmin,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'enrich-group-participants': {
        // Enrich group participants by fetching contacts and resolving real phone numbers
        const callerUserId = await requireAdminCallerUserId(supabase, req);
        if (!callerUserId) {
          return new Response(JSON.stringify({ error: 'forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const body = bodyForRouting || {};
        const groupJid = String(body.groupJid || '').trim();
        if (!groupJid || !groupJid.includes('@g.us')) {
          return new Response(JSON.stringify({ error: 'groupJid is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return await enrichGroupParticipants({
          supabase,
          evolutionConfig,
          instanceName,
          organizationId,
          groupJid,
        });
      }

      case 'check_whatsapp': {
        const body = bodyForRouting || {};
        const phones: string[] = Array.isArray(body.phones) ? body.phones : [];
        if (phones.length === 0) {
          return new Response(
            JSON.stringify({ error: 'phones array is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const numbersToCheck: string[] = [];
        const variationMap: Record<string, string> = {};

        for (const phone of phones) {
          const clean = phone.replace(/\D/g, '');
          numbersToCheck.push(clean);
          variationMap[clean] = clean;
          if (clean.startsWith('55') && clean.length === 13) {
            const without9 = '55' + clean.substring(2, 4) + clean.substring(5);
            numbersToCheck.push(without9);
            variationMap[without9] = clean;
          }
          if (clean.startsWith('55') && clean.length === 12) {
            const with9 = '55' + clean.substring(2, 4) + '9' + clean.substring(4);
            numbersToCheck.push(with9);
            variationMap[with9] = clean;
          }
        }

        const uniqueNumbers = [...new Set(numbersToCheck)];

        try {
          const batchSize = 100;
          const allResults: Array<{ number?: string; exists: boolean; jid?: string }> = [];

          for (let i = 0; i < uniqueNumbers.length; i += batchSize) {
            const batch = uniqueNumbers.slice(i, i + batchSize);
            const resp = await fetch(`${evolutionConfig.url}/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': evolutionConfig.apiKey },
              body: JSON.stringify({ numbers: batch }),
            });
            if (resp.ok) {
              const data = await resp.json();
              const results = Array.isArray(data) ? data : (data?.data || data?.result || []);
              allResults.push(...results);
            } else {
              console.error('[check_whatsapp] Evolution error:', resp.status, await resp.text());
            }
          }

          const validPhones = new Set<string>();
          const validJids: Record<string, string> = {};

          for (const result of allResults) {
            const num = String(result.number || result.jid?.split('@')[0] || '').replace(/\D/g, '');
            const original = variationMap[num] || num;
            if (result.exists) {
              validPhones.add(original);
              validJids[original] = result.jid || `${num}@s.whatsapp.net`;
            }
          }

          const invalidList: string[] = [];
          for (const phone of phones) {
            const clean = phone.replace(/\D/g, '');
            if (!validPhones.has(clean)) invalidList.push(clean);
          }

          return new Response(
            JSON.stringify({ valid: [...validPhones], invalid: invalidList, jids: validJids, total_checked: phones.length }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e) {
          console.error('[check_whatsapp] Error:', e);
          return new Response(
            JSON.stringify({ error: 'Failed to validate WhatsApp numbers', detail: String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (err) {
    const error = err as Error;
    console.error('Evolution API error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

