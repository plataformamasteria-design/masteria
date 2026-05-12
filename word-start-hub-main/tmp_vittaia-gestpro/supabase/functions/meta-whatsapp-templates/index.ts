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

        const { action, organization_id, template_data } = await req.json();
        if (!action || !organization_id) throw new Error('Missing required fields');

        // Get Meta configuration
        const { data: org } = await supabase
            .from('organizations')
            .select('settings')
            .eq('id', organization_id)
            .single();

        const settings = org?.settings || {};
        const wabaId = settings.whatsapp_cloud_waba_id;
        const accessToken = settings.whatsapp_cloud_access_token;

        if (!wabaId || !accessToken) {
            throw new Error('WhatsApp Business Account (WABA) not configured for this organization');
        }

        if (action === 'create') {
            const response = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify(template_data),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Failed to create template');

            // Save to local database
            await supabase.from('wa_official_templates').insert({
                organization_id,
                name: template_data.name,
                category: template_data.category,
                language: template_data.language,
                components: template_data.components,
                meta_template_id: data.id,
                status: data.status || 'PENDING'
            });

            return new Response(JSON.stringify({ success: true, meta_id: data.id }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (action === 'sync') {
            const response = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Failed to sync templates');

            const templates = data.data || [];
            const { data: localTemplates } = await supabase
                .from('wa_official_templates')
                .select('id, name, language, status')
                .eq('organization_id', organization_id);

            for (const t of templates) {
                const existing = localTemplates?.find(l => l.name === t.name && l.language === t.language);
                if (existing) {
                    if (existing.status !== t.status) {
                        await supabase.from('wa_official_templates').update({ status: t.status }).eq('id', existing.id);
                    }
                } else {
                    await supabase.from('wa_official_templates').insert({
                        organization_id, name: t.name, category: t.category, language: t.language,
                        components: t.components, status: t.status, meta_template_id: t.id
                    });
                }
            }

            return new Response(JSON.stringify({ success: true, count: templates.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        throw new Error('Invalid action');
    } catch (error) {
        console.error('[meta-whatsapp-templates] Error:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
