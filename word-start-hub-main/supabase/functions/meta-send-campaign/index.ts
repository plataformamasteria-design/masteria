import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing Authorization header');

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) throw new Error('Unauthorized');

        const { campaign_id, test_phone } = await req.json();
        if (!campaign_id) throw new Error('Missing campaign_id');

        // Fetch the campaign
        const { data: campaign, error: campaignError } = await supabase
            .from('wa_official_campaigns')
            .select('*, template:wa_official_templates(*)')
            .eq('id', campaign_id)
            .single();

        if (campaignError || !campaign) throw new Error('Campaign not found');

        // Get Meta configuration
        const { data: org } = await supabase
            .from('organizations')
            .select('settings')
            .eq('id', campaign.organization_id)
            .single();

        const settings = org?.settings || {};
        const phoneNumberId = settings.whatsapp_cloud_phone_number_id;
        const accessToken = settings.whatsapp_cloud_access_token;

        if (!phoneNumberId || !accessToken) {
            throw new Error('WhatsApp Cloud not configured');
        }

        // Determine recipients
        let recipients: string[] = [];
        if (test_phone) {
            recipients = [test_phone];
        } else {
            recipients = campaign.target_phones || [];
            // (Optionally add logic here to fetch from target_funnel or lists if target_phones is empty)
        }

        if (!recipients.length) {
            return new Response(JSON.stringify({ error: 'No recipients found' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        let sent = 0;
        let failed = 0;

        // Run the blast locally or spawn it depending on limits
        for (let i = 0; i < recipients.length; i++) {
            const recipientPhone = recipients[i];

            const waPayload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipientPhone,
                type: 'template',
                template: {
                    name: campaign.template.name,
                    language: { code: campaign.template.language },
                    components: campaign.template.components || [] // You can dynamically interpolate variables here
                }
            };

            try {
                const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify(waPayload),
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error?.message);
                sent++;
            } catch (err) {
                console.error(`[meta-send-campaign] Failed to send to ${recipientPhone}:`, err);
                failed++;
            }

            // Add a small delay
            if (i < recipients.length - 1) {
                await new Promise(r => setTimeout(r, (campaign.delay_seconds || 1) * 1000));
            }
        }

        if (!test_phone) {
            await supabase.from('wa_official_campaigns').update({
                sent_count: (campaign.sent_count || 0) + sent,
                failed_count: (campaign.failed_count || 0) + failed,
                status: 'completed',
                completed_at: new Date().toISOString()
            }).eq('id', campaign.id);
        }

        return new Response(JSON.stringify({ success: true, sent, failed }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('[meta-send-campaign] Error:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
