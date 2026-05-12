import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const superAdminEmail = 'Superadmin@admin.com';
    const superAdminPassword = 'Deivid!101';

    // Verificar se o usuário já existe
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users.some(u => u.email?.toLowerCase() === superAdminEmail.toLowerCase());

    if (userExists) {
      // Apenas garantir role, NÃO resetar a senha do superadmin existente
      const existingUserData = existingUser?.users.find(u => u.email?.toLowerCase() === superAdminEmail.toLowerCase());
      if (existingUserData) {

        // Garantir que tem a role de super_admin
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', existingUserData.id)
          .eq('role', 'super_admin')
          .single();

        if (!existingRole) {
          await supabase
            .from('user_roles')
            .upsert({
              user_id: existingUserData.id,
              role: 'super_admin'
            });
        }
      }

      return new Response(
        JSON.stringify({ message: 'Superadmin atualizado com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Criar o usuário superadmin
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: superAdminEmail,
      password: superAdminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Super Admin'
      }
    });

    if (createError) {
      throw createError;
    }

    // Adicionar role de super_admin
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'super_admin'
      });

    if (roleError) {
      console.error('Erro ao adicionar role:', roleError);
    }

    return new Response(
      JSON.stringify({ message: 'Superadmin criado com sucesso', userId: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Erro ao criar superadmin:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
