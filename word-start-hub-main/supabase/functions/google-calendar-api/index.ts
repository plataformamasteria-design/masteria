import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod/mod.ts";

const GoogleResponseSchema = z.object({
  id: z.string().optional(),
  hangoutLink: z.string().optional(),
  conferenceData: z.object({
    entryPoints: z.array(z.object({
      entryPointType: z.string(),
      uri: z.string()
    })).optional()
  }).optional(),
  error: z.object({
    message: z.string()
  }).optional()
}).passthrough();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, organization_id, user_id, ...params } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id missing' }), { status: 200, headers: corsHeaders });
    }

    switch (action) {
      case 'push_event': {
        const { data: event } = await supabaseClient.from('calendar_events').select('*').eq('id', params.event_id).single();
        if (!event) throw new Error("Event not found");

        const targetUserId = event.user_id || user_id;
        const token = await getValidToken(supabaseClient, organization_id, targetUserId);
        if (!token) {
          return new Response(JSON.stringify({ error: 'Sua conta não possui conexão Google ativa.' }), { status: 200, headers: corsHeaders });
        }

        const gEvent: any = {
          summary: event.title || 'Reunião',
          description: event.description || '',
          location: event.location || '',
          start: event.all_day
            ? { date: event.start_time.split('T')[0] }
            : { dateTime: event.start_time },
          end: event.all_day
            ? { date: event.end_time.split('T')[0] }
            : { dateTime: event.end_time }
        };

        if (params.generate_meet_link !== false) {
          gEvent.conferenceData = {
            createRequest: {
              requestId: event.id + Date.now().toString(),
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          };
        }

        let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';
        let method = 'POST';

        if (event.google_event_id) {
          url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.google_event_id}?conferenceDataVersion=1`;
          method = 'PUT';
        }

        const res = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gEvent)
        });

        const rawBody = await res.json();

        const parseResult = GoogleResponseSchema.safeParse(rawBody);
        if (!parseResult.success) {
          throw new Error("Invalid response schema from Google API");
        }
        const gData = parseResult.data;

        if (gData.error) throw new Error(gData.error.message);
        if (!gData.id) throw new Error("Google API responded with a success status but failed to return an event ID.");

        let meetLink = gData.hangoutLink || null;
        if (!meetLink && gData.conferenceData?.entryPoints) {
          const videoEntry = gData.conferenceData.entryPoints.find((e: any) => e.entryPointType === 'video');
          if (videoEntry) meetLink = videoEntry.uri;
        }

        let finalLocation = event.location;
        if (meetLink && (!finalLocation || !finalLocation.includes('meet.google.com'))) {
          finalLocation = finalLocation ? `${finalLocation} | ${meetLink}` : meetLink;
        }

        const updateObj: any = {
          google_event_id: gData.id,
          synced_from_google: true,
          updated_at: new Date().toISOString()
        };
        if (finalLocation !== event.location) {
          updateObj.location = finalLocation;
        }

        await supabaseClient.from('calendar_events').update(updateObj).eq('id', event.id);

        return new Response(JSON.stringify({ success: true, meet_link: meetLink, google_event_id: gData.id }), { headers: corsHeaders });
      }

      case 'sync_all': {
        if (!user_id) {
          return new Response(JSON.stringify({ error: 'user_id missing' }), { status: 200, headers: corsHeaders });
        }

        const token = await getValidToken(supabaseClient, organization_id, user_id);
        if (!token) {
          return new Response(JSON.stringify({ error: 'Sua conta não possui conexão Google ativa. Conecte pelo Ecossistema em Integrações.' }), { status: 200, headers: corsHeaders });
        }

        const syncUserId = user_id;

        const timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - 1);
        const timeMax = new Date();
        timeMax.setMonth(timeMax.getMonth() + 2);

        // Fetch user's calendar list
        const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const calListData = await calListRes.json();
        if (calListData.error) {
          // Provide clear user-facing error for scope issues
          if (calListData.error.message?.includes('insufficient authentication scopes') || calListData.error.status === 'PERMISSION_DENIED') {
            return new Response(JSON.stringify({
              error: 'A conta Google conectada não possui permissão de Agenda. Reconecte pelo Ecossistema Google em Configurações → Integrações para obter as permissões necessárias.'
            }), { status: 200, headers: corsHeaders });
          }
          throw new Error(calListData.error.message);
        }

        let updatedCount = 0;
        let insertedCount = 0;
        let errorCount = 0;
        let totalPulled = 0;
        let debugLog: string[] = [];

        const calendarsToFetch = calListData.items || [];
        debugLog.push(`Encontrados ${calendarsToFetch.length} calendários. user_id: ${syncUserId}`);

        for (const calendar of calendarsToFetch) {
          debugLog.push(`Tentando ID: ${calendar.id}`);
          const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const gData = await res.json();
          if (gData.error) {
            debugLog.push(`Erro no ID ${calendar.id}: ${gData.error.message}`);
            continue;
          }

          const itemsToProcess = gData.items || [];
          totalPulled += itemsToProcess.length;
          debugLog.push(`ID ${calendar.id} retornou ${itemsToProcess.length} eventos`);

          for (const item of itemsToProcess) {
            if (item.status === 'cancelled') continue;

            const evData: Record<string, any> = {
              organization_id,
              user_id: syncUserId,
              google_event_id: item.id,
              title: item.summary || '(Sem Título)',
              description: item.description || null,
              location: item.location || item.hangoutLink || null,
              start_time: item.start?.dateTime || (item.start?.date ? `${item.start.date}T00:00:00Z` : null),
              end_time: item.end?.dateTime || (item.end?.date ? `${item.end.date}T23:59:59Z` : null),
              all_day: !!item.start?.date,
              synced_from_google: true,
            };

            if (!evData.start_time) continue;

            const { data: existing } = await supabaseClient.from('calendar_events').select('id').eq('google_event_id', item.id).eq('organization_id', organization_id).maybeSingle();
            if (existing) {
              const { error: upErr } = await supabaseClient.from('calendar_events').update(evData).eq('id', existing.id);
              if (!upErr) updatedCount++;
              else { errorCount++; debugLog.push(`Update DB Error: ${upErr.message}`); }
            } else {
              const { error } = await supabaseClient.from('calendar_events').insert(evData);
              if (!error) insertedCount++;
              else { errorCount++; debugLog.push(`Insert DB Error: ${error.message}`); }
            }
          }
        }

        return new Response(JSON.stringify({ success: true, pulled: totalPulled, inserted: insertedCount, updated: updatedCount, errors: errorCount, debug_log: debugLog }), { headers: corsHeaders });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action: ' + action }), { status: 200, headers: corsHeaders });
    }

  } catch (e: any) {
    console.error('calendar error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 200, headers: corsHeaders });
  }
});

async function getValidToken(supabase: any, orgId: string, userId: string): Promise<string | null> {
  // Fetch ALL google connections for the org and user
  const { data: connections } = await supabase
    .from('google_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('is_connected', true);

  if (!connections || connections.length === 0) return null;

  // Prefer ecosystem > google_calendar > google_business > any
  const conn = connections.find((c: any) => c.service_type === 'ecosystem')
    || connections.find((c: any) => c.service_type === 'google_calendar')
    || connections.find((c: any) => c.service_type === 'google_business')
    || connections[0];

  if (!conn?.is_connected || !conn?.access_token) return null;

  if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
    if (!conn.refresh_token) return null;

    let clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    let clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    const { data: globalConfigData } = await supabase
      .from('global_config')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret']);

    const configClientId = globalConfigData?.find((c: any) => c.key === 'google_ads_client_id')?.value;
    const configClientSecret = globalConfigData?.find((c: any) => c.key === 'google_ads_client_secret')?.value;

    if (configClientId && configClientSecret) {
      clientId = configClientId;
      clientSecret = configClientSecret;
    }

    if (!clientId || !clientSecret) return null;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: newSearchParams({ // fix URL search params
        refresh_token: conn.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      } as any),
    });

    // NOTE: new URLSearchParams in Deno works fine! I'll fix the function: 
    // Wait, Deno doesn't have a problem, I just made a typo above 'newSearchParams'. Replaced next line

    const data = await res.json();
    if (data.error) return null;

    await supabase
      .from('google_connections')
      .update({
        access_token: data.access_token,
        token_expiry: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
      })
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('service_type', conn.service_type);

    return data.access_token;
  }

  return conn.access_token;
}

function newSearchParams(obj: any): string {
  return Object.keys(obj).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&');
}
