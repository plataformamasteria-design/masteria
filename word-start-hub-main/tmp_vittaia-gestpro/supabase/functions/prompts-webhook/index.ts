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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    let organization_id = url.searchParams.get('organization_id');
    const prompt_id = url.searchParams.get('id');
    const action = url.searchParams.get('action'); // 'list', 'get', 'delete', 'save'

    let body: any = null;
    if (req.method === 'POST' || req.method === 'PUT') {
      try { body = await req.json(); } catch { body = {}; }
      if (!organization_id) organization_id = body?.organization_id || null;
    }

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // AUTH for user_id attribution
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await authClient.auth.getUser();
      userId = user?.id || null;
    }

    // ACTION: DELETE
    if (req.method === 'DELETE' || action === 'delete') {
      if (!prompt_id) return new Response(JSON.stringify({ error: 'id is required for delete' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { error } = await supabase.from('ai_prompts').delete().eq('id', prompt_id).eq('organization_id', organization_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ACTION: LIST / GET
    if (req.method === 'GET' || action === 'list' || action === 'get') {
      let query = supabase.from('ai_prompts').select('*').eq('organization_id', organization_id);
      if (prompt_id) {
        const { data, error } = await query.eq('id', prompt_id).maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return new Response(JSON.stringify({ prompts: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ACTION: SAVE (Create or Update)
    if (req.method === 'POST' || req.method === 'PUT' || action === 'save') {
      const { fields, name, description, id } = body;

      if (!fields || !Array.isArray(fields)) {
        return new Response(JSON.stringify({ error: 'fields array is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const promptData = {
        organization_id,
        name: name || 'Novo Prompt',
        description: description || '',
        fields,
        updated_at: new Date().toISOString()
      };

      let result;
      if (id || prompt_id) {
        result = await supabase.from('ai_prompts').update(promptData).eq('id', id || prompt_id).eq('organization_id', organization_id).select().single();
      } else {
        if (!userId) return new Response(JSON.stringify({ error: 'Auth required for new prompts' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await supabase.from('ai_prompts').insert({ ...promptData, user_id: userId }).select().single();
      }

      if (result.error) throw result.error;
      return new Response(JSON.stringify(result.data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
