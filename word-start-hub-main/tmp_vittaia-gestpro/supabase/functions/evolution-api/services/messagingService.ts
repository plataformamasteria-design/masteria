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

export async function ensureLeadFromPhone(params: {
  supabase: any;
  evolutionConfig: EvolutionApiConfig;
  instanceName: string;
  organizationId: string;
  phone: string;
  pushName: string | null;
}): Promise<Response> {
  const { supabase, evolutionConfig, instanceName, organizationId, phone, pushName } = params;
  try {
    // 1) Validate + canonicalize + fetch profile data (same flow as NewContact)
    const validationRes = await validateWhatsAppNumber(evolutionConfig, instanceName, [phone]);
    const parsed = await validationRes.json().catch(() => null);
    const result = parsed?.results?.[0] || null;

    if (!result?.exists) {
      // IMPORTANT: treat as a business validation error (not a transport error).
      // Returning 200 avoids some clients/runtimes surfacing this expected case
      // as an uncaught runtime error (blank screen) while still preserving the
      // error code/message in the payload for UX handling.
      return new Response(
        JSON.stringify({
          success: false,
          error: 'number_not_on_whatsapp',
          message: 'Este número não está registrado no WhatsApp.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const canonical = String(result.canonicalNumber || phone).replace(/\D/g, '');
    const profileName = (result.profileName ? String(result.profileName) : null) || pushName;
    const profilePictureUrl = result.profilePictureUrl ? String(result.profilePictureUrl) : null;

    // 2) Find existing lead (by canonical OR original)
    const { data: existing } = await supabase
      .from('chats')
      .select('id, phone, wa_name, wa_photo_url')
      .eq('organization_id', organizationId)
      .eq('is_group', false)
      .or(`phone.eq.${canonical},phone.eq.${phone}`)
      .maybeSingle();

    let chatId: string | null = existing?.id ? String(existing.id) : null;

    if (!chatId) {
      const { data: inserted, error } = await supabase
        .from('chats')
        .insert({
          organization_id: organizationId,
          phone: canonical,
          is_group: false,
          wa_name: profileName,
          wa_photo_url: profilePictureUrl,
          agent_off: false,
        })
        .select('id')
        .single();
      if (error) throw error;
      chatId = inserted?.id ? String(inserted.id) : null;
    } else {
      // Best-effort update missing info
      const patch: any = {};
      if (canonical && existing.phone !== canonical) patch.phone = canonical;
      if (profileName && !existing.wa_name) patch.wa_name = profileName;
      if (profilePictureUrl && !existing.wa_photo_url) patch.wa_photo_url = profilePictureUrl;
      if (Object.keys(patch).length) {
        await supabase
          .from('chats')
          .update(patch)
          .eq('id', chatId)
          .eq('organization_id', organizationId);
      }
    }

    return new Response(JSON.stringify({ success: true, chatId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[ensure-lead-from-phone] failed:', e);
    return new Response(JSON.stringify({ error: 'internal_error', details: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function validateWhatsAppNumber(
  config: EvolutionApiConfig,
  instanceName: string,
  numbers: string[]
) {
  try {
    console.log('Validating WhatsApp numbers:', numbers);

    // Clean numbers - remove non-digits
    const cleanedNumbers = numbers.map(n => n.replace(/\D/g, ''));

    const response = await fetch(`${config.url}/chat/whatsappNumbers/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({ numbers: cleanedNumbers }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp number validation error:', errorText);
      throw new Error(`Failed to validate numbers: ${errorText}`);
    }

    const data = await response.json();
    console.log('WhatsApp number validation result:', data);

    // Evolution API returns array of objects with:
    // { exists: boolean, jid: string, number: string }
    // The jid contains the canonical number (e.g., "558892161399@s.whatsapp.net")
    const results = await Promise.all((data || []).map(async (item: any) => {
      const result: any = {
        exists: item.exists || false,
        jid: item.jid || null,
        // Extract canonical number from jid (before @)
        canonicalNumber: item.jid ? item.jid.split('@')[0] : item.number,
        originalNumber: item.number,
        profilePictureUrl: null,
        profileName: null,
      };

      // If number exists, fetch profile picture and name
      if (result.exists && result.canonicalNumber) {
        try {
          // Fetch profile picture
          const photoResponse = await fetch(`${config.url}/chat/fetchProfilePictureUrl/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': config.apiKey,
            },
            body: JSON.stringify({ number: result.canonicalNumber }),
          });

          if (photoResponse.ok) {
            const photoData = await photoResponse.json();
            result.profilePictureUrl = photoData.profilePictureUrl || null;
            console.log('Fetched profile picture:', result.profilePictureUrl ? 'yes' : 'no');
          }
        } catch (e) {
          console.log('Error fetching profile picture:', e);
        }

        try {
          // Fetch profile info (for name)
          const profileResponse = await fetch(`${config.url}/chat/fetchProfile/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': config.apiKey,
            },
            body: JSON.stringify({ number: result.canonicalNumber }),
          });

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            result.profileName = profileData.name || profileData.pushName || null;
            console.log('Fetched profile name:', result.profileName);
          }
        } catch (e) {
          console.log('Error fetching profile info:', e);
        }
      }

      return result;
    }));

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error validating WhatsApp number:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function sendTextMessage(
  config: EvolutionApiConfig,
  instanceName: string,
  number: string,
  text: string
) {
  try {
    console.log('Sending text message to:', number);

    const cleanNumber = number.replace(/\D/g, '');

    const response = await fetch(`${config.url}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.apiKey,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Send text message error:', errorText);
      throw new Error(`Failed to send message: ${errorText}`);
    }

    const data = await response.json();
    console.log('Message sent successfully:', data);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error sending text message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

