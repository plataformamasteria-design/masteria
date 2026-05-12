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
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        // Verify auth header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Admin client for DB operations and password reset
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // User client to validate caller identity (same pattern as marketing-api)
        const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        const token = authHeader.replace('Bearer ', '');
        const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
        if (claimsError || !claimsData?.claims) {
            console.error('auth claims error:', claimsError?.message);
            return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const callerId = claimsData.claims.sub;

        // Check super_admin role
        const { data: roles } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', callerId)
            .eq('role', 'super_admin');

        if (!roles?.length) {
            return new Response(JSON.stringify({ error: 'Forbidden: super_admin required' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { user_id, new_password } = await req.json();

        if (!user_id || !new_password) {
            return new Response(JSON.stringify({ error: 'user_id and new_password are required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (new_password.length < 6) {
            return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Reset the user's password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            { password: new_password }
        );

        if (updateError) {
            throw updateError;
        }

        return new Response(
            JSON.stringify({ ok: true, message: 'Senha atualizada com sucesso' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('admin-reset-password error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
