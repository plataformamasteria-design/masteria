import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar o superadmin pelo email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      throw listError;
    }

    const superadmin = users.users.find(u => u.email === 'superadmin@admin.com');

    if (!superadmin) {
      return new Response(
        JSON.stringify({ error: 'Superadmin não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pegar senha do body ou usar default
    let newPassword = 'Deivid!101';
    try {
      const body = await req.json();
      if (body?.password) newPassword = body.password;
    } catch (_) { /* no body */ }

    // Atualizar a senha
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      superadmin.id,
      { password: newPassword }
    );

    if (updateError) {
      throw updateError;
    }

    // Revogar todas as sessões do usuário (logout forçado)
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(superadmin.id);

    if (signOutError) {
      console.error('Erro ao deslogar sessões:', signOutError);
      // Não vamos falhar a operação por causa disso
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha do superadmin atualizada e todas as sessões foram encerradas'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
