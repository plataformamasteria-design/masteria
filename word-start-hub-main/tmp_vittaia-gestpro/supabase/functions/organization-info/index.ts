import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const organizationId = url.searchParams.get('organization_id')

    if (!organizationId) {
      console.error('Missing organization_id parameter')
      return new Response(
        JSON.stringify({ success: false, error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Fetching organization info for: ${organizationId}`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      console.error('Organization not found:', orgError)
      return new Response(
        JSON.stringify({ success: false, error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found organization: ${org.name}`)

    // Fetch webhooks
    const { data: webhooks } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('organization_id', organizationId)

    // Fetch tags
    const { data: tags } = await supabase
      .from('tags')
      .select('id, name, color, icon')
      .eq('organization_id', organizationId)
      .order('order_position', { ascending: true })

    // Fetch users/profiles
    const { data: users } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('organization_id', organizationId)

    // Fetch teams with member count
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, color, description, active')
      .eq('organization_id', organizationId)

    // Get team member counts separately
    const teamsWithCounts = await Promise.all(
      (teams || []).map(async (team) => {
        const { count } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id)
        return { ...team, member_count: count || 0 }
      })
    )

    // Get chat count
    const { count: chatCount } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    // Get message count
    const { count: messageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    // Get today's active chats
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: activeToday } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('last_message_at', today.toISOString())

    // Format webhooks by type
    const formattedWebhooks: Record<string, any> = {}
    webhooks?.forEach(wh => {
      formattedWebhooks[wh.webhook_type] = {
        id: wh.id,
        name: wh.name,
        url: wh.url,
        active: wh.active,
        headers: wh.headers
      }
    })

    // Build response
    const response = {
      success: true,
      data: {
        api_config: {
          base_url: supabaseUrl,
          api_key: anonKey,
          organization_id: org.id,
          organization_name: org.name,
          organization_slug: org.slug,
          plan: org.plan,
          active: org.active
        },
        evolution_api: {
          url: org.evolution_api_url,
          api_key: org.evolution_api_key,
          instance_name: org.instance_name,
          webhook_url: org.evolution_webhook_url
        },
        webhooks: formattedWebhooks,
        organization_ids: {
          tags: tags || [],
          users: users || [],
          teams: teamsWithCounts
        },
        stats: {
          total_chats: chatCount || 0,
          total_messages: messageCount || 0,
          active_today: activeToday || 0
        },
        endpoints: {
          chat_webhook: `${supabaseUrl}/functions/v1/chat-webhook`,
          messages_webhook: `${supabaseUrl}/functions/v1/messages-webhook`,
          tags_webhook: `${supabaseUrl}/functions/v1/tags-webhook`,
          chat_tags_webhook: `${supabaseUrl}/functions/v1/chat-tags-webhook`,
          evolution_webhook: `${supabaseUrl}/functions/v1/z-api-webhook`,
          organization_info: `${supabaseUrl}/functions/v1/organization-info`
        },
        created_at: org.created_at,
        updated_at: org.updated_at
      }
    }

    console.log('Successfully built organization info response')

    return new Response(
      JSON.stringify(response, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in organization-info:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
