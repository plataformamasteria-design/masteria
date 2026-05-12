import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TagData {
  id?: string;
  name?: string;
  color?: string;
  icon?: string;
  order_position?: number;
  organization_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const method = req.method;
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organization_id');
    
    console.log(`[tags-webhook] ${method} request received, organization_id: ${organizationId}`);

    // GET - Listar todas as tags (filtradas por organization_id se fornecido)
    if (method === 'GET') {
      let query = supabase
        .from('tags')
        .select('*')
        .order('order_position', { ascending: true });

      // Filtrar por organization_id se fornecido
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[tags-webhook] Error fetching tags:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[tags-webhook] Found ${data?.length || 0} tags`);
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Criar nova tag
    if (method === 'POST') {
      const body: TagData = await req.json();

      if (!body.name) {
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "name" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Usar organization_id do body ou da URL
      const orgId = body.organization_id || organizationId;
      
      if (!orgId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "organization_id" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[tags-webhook] Creating tag: ${body.name} for organization: ${orgId}`);

      const { data, error } = await supabase
        .from('tags')
        .insert({
          name: body.name,
          color: body.color || '#3B82F6',
          icon: body.icon || 'Tag',
          order_position: body.order_position || 0,
          organization_id: orgId,
        })
        .select()
        .single();

      if (error) {
        console.error('[tags-webhook] Error creating tag:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[tags-webhook] Tag created successfully: ${data.id}`);
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Atualizar tag existente
    if (method === 'PUT') {
      const body: TagData = await req.json();

      if (!body.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Campo "id" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[tags-webhook] Updating tag: ${body.id}`);

      const updateData: any = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.color !== undefined) updateData.color = body.color;
      if (body.icon !== undefined) updateData.icon = body.icon;
      if (body.order_position !== undefined) updateData.order_position = body.order_position;

      let query = supabase
        .from('tags')
        .update(updateData)
        .eq('id', body.id);

      // Filtrar por organization_id para segurança multi-tenant
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query.select().single();

      if (error) {
        console.error('[tags-webhook] Error updating tag:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[tags-webhook] Tag updated successfully`);
      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Remover tag
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');

      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Parâmetro "id" é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[tags-webhook] Deleting tag: ${id}`);

      let query = supabase.from('tags').delete().eq('id', id);

      // Filtrar por organization_id para segurança multi-tenant
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { error } = await query;

      if (error) {
        console.error('[tags-webhook] Error deleting tag:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[tags-webhook] Tag deleted successfully`);
      return new Response(
        JSON.stringify({ success: true, message: 'Tag removida com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Método não suportado' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[tags-webhook] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
