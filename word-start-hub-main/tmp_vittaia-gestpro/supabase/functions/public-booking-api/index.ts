import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface BookingRequest {
  organization_slug: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  client_notes?: string;
  service_name?: string;
  start_time: string;
  end_time: string;
  calendar_id?: string;
}

interface AvailabilityRequest {
  organization_slug: string;
  date: string; // YYYY-MM-DD
  calendar_id?: string;
}

// Helper: parse "YYYY-MM-DD" as local date (avoid UTC interpretation)
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Helper: get UTC boundaries for a local day (for DB queries)
function getLocalDayBoundsUTC(dateStr: string): { start: string; end: string } {
  const date = parseLocalDate(dateStr);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return {
    start: dayStart.toISOString(),
    end: dayEnd.toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    // GET /config?slug=org-slug&calendar_id=xxx
    if (req.method === 'GET' && path === 'config') {
      const slug = url.searchParams.get('slug');
      if (!slug) {
        return new Response(JSON.stringify({ error: 'Slug é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('slug', slug)
        .eq('active', true)
        .maybeSingle();

      if (orgError || !org) {
        return new Response(JSON.stringify({ error: 'Organização não encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: config, error: configError } = await supabase
        .from('booking_config')
        .select('*')
        .eq('organization_id', org.id)
        .eq('active', true)
        .maybeSingle();

      if (configError || !config) {
        return new Response(JSON.stringify({ error: 'Agendamento não configurado para esta organização' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const publicConfig = {
        organization_name: org.name,
        organization_id: org.id,
        widget_title: config.widget_title,
        widget_description: config.widget_description,
        primary_color: config.primary_color,
        working_days: config.working_days,
        start_time: config.start_time,
        end_time: config.end_time,
        slot_duration_minutes: config.slot_duration_minutes,
        buffer_minutes: config.buffer_minutes,
        max_advance_days: config.max_advance_days,
        min_advance_hours: config.min_advance_hours,
        services: config.services,
        require_phone: config.require_phone,
        require_email: config.require_email,
        require_notes: config.require_notes,
        calendar_id: config.calendar_id,
      };

      return new Response(JSON.stringify(publicConfig), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /availability?slug=org-slug&date=YYYY-MM-DD&calendar_id=xxx
    if (req.method === 'GET' && path === 'availability') {
      const slug = url.searchParams.get('slug');
      const dateStr = url.searchParams.get('date');
      const calendarId = url.searchParams.get('calendar_id');

      if (!slug || !dateStr) {
        return new Response(JSON.stringify({ error: 'Slug e data são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .eq('active', true)
        .maybeSingle();

      if (orgError || !org) {
        return new Response(JSON.stringify({ error: 'Organização não encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: config, error: configError } = await supabase
        .from('booking_config')
        .select('*')
        .eq('organization_id', org.id)
        .eq('active', true)
        .maybeSingle();

      if (configError || !config) {
        return new Response(JSON.stringify({ error: 'Configuração não encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Parse date as local
      const requestedDate = parseLocalDate(dateStr);
      const dayOfWeek = requestedDate.getDay();

      if (!config.working_days.includes(dayOfWeek)) {
        return new Response(JSON.stringify({ available_slots: [], message: 'Dia não disponível' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get UTC bounds for the local day
      const { start: dayStart, end: dayEnd } = getLocalDayBoundsUTC(dateStr);

      // Build events query - filter by calendar_id if provided
      let eventsQuery = supabase
        .from('calendar_events')
        .select('start_time, end_time')
        .eq('organization_id', org.id)
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd);

      // Filter by specific calendar if calendar_id is provided
      const effectiveCalendarId = calendarId || config.calendar_id;
      if (effectiveCalendarId) {
        eventsQuery = eventsQuery.eq('calendar_id', effectiveCalendarId);
      }

      const { data: existingEvents, error: eventsError } = await eventsQuery;

      if (eventsError) {
        console.error('Events error:', eventsError);
        return new Response(JSON.stringify({ error: 'Erro ao buscar eventos' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get existing bookings for the day
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('organization_id', org.id)
        .neq('status', 'cancelled')
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd);

      if (bookingsError) {
        console.error('Bookings error:', bookingsError);
      }

      // Generate slots using local time
      const slots: { start: string; end: string; available: boolean }[] = [];
      const [startHour, startMin] = config.start_time.split(':').map(Number);
      const [endHour, endMin] = config.end_time.split(':').map(Number);
      const slotDuration = config.slot_duration_minutes;
      const buffer = config.buffer_minutes;
      const minAdvanceHours = config.min_advance_hours;

      const now = new Date();
      const minBookingTime = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);

      let currentSlotStart = new Date(requestedDate);
      currentSlotStart.setHours(startHour, startMin, 0, 0);

      const workDayEnd = new Date(requestedDate);
      workDayEnd.setHours(endHour, endMin, 0, 0);

      while (currentSlotStart < workDayEnd) {
        const slotEnd = new Date(currentSlotStart.getTime() + slotDuration * 60 * 1000);

        if (slotEnd > workDayEnd) break;

        const isPast = currentSlotStart < minBookingTime;

        const slotStartISO = currentSlotStart.toISOString();
        const slotEndISO = slotEnd.toISOString();

        const conflictsWithEvents = existingEvents?.some((event: any) => {
          const eventStart = new Date(event.start_time);
          const eventEnd = new Date(event.end_time);
          return (currentSlotStart < eventEnd && slotEnd > eventStart);
        }) || false;

        const conflictsWithBookings = existingBookings?.some((booking: any) => {
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);
          return (currentSlotStart < bookingEnd && slotEnd > bookingStart);
        }) || false;

        slots.push({
          start: slotStartISO,
          end: slotEndISO,
          available: !isPast && !conflictsWithEvents && !conflictsWithBookings,
        });

        currentSlotStart = new Date(currentSlotStart.getTime() + (slotDuration + buffer) * 60 * 1000);
      }

      return new Response(JSON.stringify({
        available_slots: slots,
        date: dateStr,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /book - Create a new booking
    if (req.method === 'POST' && path === 'book') {
      const body: BookingRequest = await req.json();

      if (!body.organization_slug || !body.client_name || !body.client_phone || !body.start_time || !body.end_time) {
        return new Response(JSON.stringify({ error: 'Campos obrigatórios: organization_slug, client_name, client_phone, start_time, end_time' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('slug', body.organization_slug)
        .eq('active', true)
        .maybeSingle();

      if (orgError || !org) {
        return new Response(JSON.stringify({ error: 'Organização não encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: config, error: configError } = await supabase
        .from('booking_config')
        .select('*')
        .eq('organization_id', org.id)
        .eq('active', true)
        .maybeSingle();

      if (configError || !config) {
        return new Response(JSON.stringify({ error: 'Agendamento não habilitado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const cleanPhone = body.client_phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        return new Response(JSON.stringify({ error: 'Telefone inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate all phone variants for Brazilian numbers to avoid duplicates
      const phoneVariantsSet = new Set<string>();
      phoneVariantsSet.add(cleanPhone);

      // Normalize to 55+DDD+9+number (13 digits) as the canonical form
      let normalized = cleanPhone;

      // If phone doesn't start with 55, add country code
      if (!cleanPhone.startsWith('55')) {
        normalized = '55' + cleanPhone;
      }

      phoneVariantsSet.add(normalized);

      // Brazilian format: 55 + DDD(2) + 9 + number(8) = 13 digits
      // or 55 + DDD(2) + number(8) = 12 digits
      if (normalized.length === 13 && normalized.startsWith('55')) {
        // Has the 9 → also search without it
        const without9 = normalized.slice(0, 4) + normalized.slice(5);
        phoneVariantsSet.add(without9);
        // Also add without country code
        phoneVariantsSet.add(normalized.slice(2)); // DDD+9+number (11 digits)
        phoneVariantsSet.add(without9.slice(2));   // DDD+number (10 digits)
      } else if (normalized.length === 12 && normalized.startsWith('55')) {
        // Missing the 9 → also search with it
        const with9 = normalized.slice(0, 4) + '9' + normalized.slice(4);
        phoneVariantsSet.add(with9);
        // Also add without country code
        phoneVariantsSet.add(normalized.slice(2)); // DDD+number (10 digits)
        phoneVariantsSet.add(with9.slice(2));       // DDD+9+number (11 digits)
      } else if (normalized.length === 11) {
        // DDD + 9 + number without country code
        phoneVariantsSet.add('55' + normalized);
        const without9 = normalized.slice(0, 2) + normalized.slice(3);
        phoneVariantsSet.add(without9);
        phoneVariantsSet.add('55' + without9);
      } else if (normalized.length === 10) {
        // DDD + number without 9 and without country code
        phoneVariantsSet.add('55' + normalized);
        const with9 = normalized.slice(0, 2) + '9' + normalized.slice(2);
        phoneVariantsSet.add(with9);
        phoneVariantsSet.add('55' + with9);
      }

      const phoneVariants = Array.from(phoneVariantsSet);
      console.log('[public-booking-api] Phone variants for lookup:', phoneVariants);

      const startTime = new Date(body.start_time);
      const endTime = new Date(body.end_time);

      // Check conflicts - filter by calendar if applicable
      const effectiveCalendarId = body.calendar_id || config.calendar_id;

      let eventsConflictQuery = supabase
        .from('calendar_events')
        .select('id')
        .eq('organization_id', org.id)
        .lt('start_time', endTime.toISOString())
        .gt('end_time', startTime.toISOString());

      if (effectiveCalendarId) {
        eventsConflictQuery = eventsConflictQuery.eq('calendar_id', effectiveCalendarId);
      }

      const { data: conflictingEvents } = await eventsConflictQuery;

      const { data: conflictingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('organization_id', org.id)
        .neq('status', 'cancelled')
        .lt('start_time', endTime.toISOString())
        .gt('end_time', startTime.toISOString());

      if ((conflictingEvents && conflictingEvents.length > 0) || (conflictingBookings && conflictingBookings.length > 0)) {
        return new Response(JSON.stringify({ error: 'Horário não está mais disponível' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const cancellationToken = crypto.randomUUID();

      // Create or find chat — search all phone variants to avoid duplicates
      let chatId: string | null = null;
      let resolvedPhone = cleanPhone; // the phone we'll actually store

      if (config.auto_create_chat) {
        // Try to find existing chat with any of the phone variants
        const { data: existingChat } = await supabase
          .from('chats')
          .select('id, phone')
          .eq('organization_id', org.id)
          .in('phone', phoneVariants)
          .limit(1)
          .maybeSingle();

        if (existingChat) {
          chatId = existingChat.id;
          resolvedPhone = existingChat.phone; // use the phone already in the DB
          console.log('[public-booking-api] Found existing chat:', chatId, 'with phone:', resolvedPhone);
        } else {
          // No existing lead — store with the 13-digit variant (with 9) for WhatsApp delivery
          const whatsappPhone = phoneVariants.find(p => p.length === 13) || cleanPhone;
          const { data: newChat, error: chatError } = await supabase
            .from('chats')
            .insert({
              organization_id: org.id,
              phone: whatsappPhone,
              wa_name: body.client_name,
              agent_off: true,
              is_group: false,
            })
            .select('id')
            .single();

          if (!chatError && newChat) {
            chatId = newChat.id;
            resolvedPhone = whatsappPhone;
            console.log('[public-booking-api] Created new chat:', chatId, 'with phone:', resolvedPhone);
          }
        }

        // Apply auto tag
        if (chatId && config.auto_apply_tag_id) {
          const { data: existingTag } = await supabase
            .from('chat_tags')
            .select('id')
            .eq('chat_id', chatId)
            .eq('tag_id', config.auto_apply_tag_id)
            .maybeSingle();

          if (!existingTag) {
            await supabase
              .from('chat_tags')
              .insert({
                chat_id: chatId,
                tag_id: config.auto_apply_tag_id,
                organization_id: org.id,
              });
          }
        }

        // Auto-assign agent
        if (chatId && config.auto_assign_agent_id) {
          await supabase
            .from('chats')
            .update({
              assigned_to: config.auto_assign_agent_id,
              assigned_at: new Date().toISOString(),
            })
            .eq('id', chatId);
          console.log('[public-booking-api] Auto-assigned agent:', config.auto_assign_agent_id);
        }

        // Auto-assign funnel/stage
        if (chatId && config.auto_assign_funnel_id) {
          let stageId = config.auto_assign_stage_id;

          // If no specific stage, use the first stage of the funnel
          if (!stageId) {
            const { data: firstStage } = await supabase
              .from('funnel_stages')
              .select('id')
              .eq('funnel_id', config.auto_assign_funnel_id)
              .order('order_position', { ascending: true })
              .limit(1)
              .maybeSingle();
            if (firstStage) stageId = firstStage.id;
          }

          if (stageId) {
            // Check if already in this funnel
            const { data: existingFunnel } = await supabase
              .from('chat_funnel_stage')
              .select('id')
              .eq('chat_id', chatId)
              .eq('funnel_id', config.auto_assign_funnel_id)
              .maybeSingle();

            if (!existingFunnel) {
              await supabase
                .from('chat_funnel_stage')
                .insert({
                  chat_id: chatId,
                  funnel_id: config.auto_assign_funnel_id,
                  stage_id: stageId,
                  organization_id: org.id,
                });
              console.log('[public-booking-api] Auto-assigned funnel:', config.auto_assign_funnel_id, 'stage:', stageId);
            }
          }
        }
      }

      // Create calendar event - with correct calendar_id and without user_id (nullable)
      const { data: calendarEvent, error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          organization_id: org.id,
          title: `Agendamento: ${body.client_name}`,
          description: `Telefone: ${body.client_phone}${body.client_email ? `\nEmail: ${body.client_email}` : ''}${body.client_notes ? `\nObservações: ${body.client_notes}` : ''}${body.service_name ? `\nServiço: ${body.service_name}` : ''}`,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          chat_id: chatId,
          calendar_id: effectiveCalendarId || null,
          color: config.primary_color,
        })
        .select('id')
        .single();

      if (eventError) {
        console.error('Calendar event error:', eventError);
      }

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          organization_id: org.id,
          client_name: body.client_name,
          client_phone: resolvedPhone,
          client_email: body.client_email,
          client_notes: body.client_notes,
          service_name: body.service_name,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          calendar_event_id: calendarEvent?.id || null,
          chat_id: chatId,
          cancellation_token: cancellationToken,
          status: 'confirmed',
        })
        .select('*')
        .single();

      if (bookingError) {
        console.error('Booking error:', bookingError);
        return new Response(JSON.stringify({ error: 'Erro ao criar agendamento' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Trigger webhook
      if (config.send_confirmation_webhook) {
        const { data: webhooks } = await supabase
          .from('webhook_configs')
          .select('*')
          .eq('organization_id', org.id)
          .eq('webhook_type', 'sent')
          .eq('active', true);

        if (webhooks && webhooks.length > 0) {
          // Fire-and-forget: don't await webhook calls to avoid blocking the response
          const webhookPayload = JSON.stringify({
            type: 'booking_created',
            booking: {
              id: booking.id,
              client_name: body.client_name,
              client_phone: resolvedPhone,
              client_email: body.client_email,
              service_name: body.service_name,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              cancellation_token: cancellationToken,
            },
            organization: { id: org.id, name: org.name },
          });

          for (const webhook of webhooks) {
            // Use AbortController with 5s timeout and don't await
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            fetch(webhook.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(webhook.headers || {}),
              },
              body: webhookPayload,
              signal: controller.signal,
            })
              .catch((err: any) => console.error('Webhook error:', err.message))
              .finally(() => clearTimeout(timeoutId));
          }
        }
      }

      console.log(`Booking created: ${booking.id} for ${body.client_name}`);

      return new Response(JSON.stringify({
        success: true,
        booking: {
          id: booking.id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          cancellation_token: cancellationToken,
        },
        message: 'Agendamento confirmado!',
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /cancel
    if (req.method === 'POST' && path === 'cancel') {
      const { token, reason } = await req.json();

      if (!token) {
        return new Response(JSON.stringify({ error: 'Token de cancelamento obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: booking, error: findError } = await supabase
        .from('bookings')
        .select('*, calendar_event_id')
        .eq('cancellation_token', token)
        .maybeSingle();

      if (findError || !booking) {
        return new Response(JSON.stringify({ error: 'Agendamento não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (booking.status === 'cancelled') {
        return new Response(JSON.stringify({ error: 'Agendamento já cancelado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || 'Cancelado pelo cliente',
        })
        .eq('id', booking.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Erro ao cancelar' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (booking.calendar_event_id) {
        await supabase
          .from('calendar_events')
          .delete()
          .eq('id', booking.calendar_event_id);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Agendamento cancelado com sucesso',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
