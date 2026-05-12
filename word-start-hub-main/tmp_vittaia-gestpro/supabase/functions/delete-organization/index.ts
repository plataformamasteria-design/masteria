import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function batchDelete(client: any, table: string, orgId: string, batchSize = 500): Promise<string | null> {
  let totalDeleted = 0
  while (true) {
    const { data: rows, error: selectError } = await client
      .from(table)
      .select('id')
      .eq('organization_id', orgId)
      .limit(batchSize)

    if (selectError) return `${table}: ${selectError.message}`
    if (!rows || rows.length === 0) break

    const ids = rows.map((r: any) => r.id)
    const { error: deleteError } = await client.from(table).delete().in('id', ids)
    if (deleteError) return `${table}: ${deleteError.message}`

    totalDeleted += ids.length
    console.log(`Deleted ${totalDeleted} rows from ${table}`)
    if (rows.length < batchSize) break
  }
  return null
}

async function safeDelete(client: any, table: string, orgId: string, errors: string[]) {
  const { error } = await client.from(table).delete().eq('organization_id', orgId)
  if (error) {
    console.error(`Error deleting from ${table}:`, error.message)
    errors.push(`${table}: ${error.message}`)
  } else {
    console.log(`Cleaned ${table}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No valid Authorization header found')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate user using anon client with user's token
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('Auth validation failed:', claimsError?.message)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userId = claimsData.claims.sub

    // Validate user is super_admin using service role client (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await adminClient.from('user_roles').select('role').eq('user_id', userId).eq('role', 'super_admin').maybeSingle()
    if (!roleData) {
      console.error('User is not super_admin:', userId)
      return new Response(JSON.stringify({ error: 'Only super admins can delete organizations' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { organization_id } = await req.json()
    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const errors: string[] = []
    const orgId = organization_id

    // ── Phase 1: Automation tables (deep children first) ──
    console.log('Phase 1: Automation cleanup...')
    await safeDelete(adminClient, 'automation_execution_logs', orgId, errors)
    await safeDelete(adminClient, 'automation_executions', orgId, errors)
    await safeDelete(adminClient, 'automation_node_stats', orgId, errors)
    await safeDelete(adminClient, 'automation_edges', orgId, errors)
    await safeDelete(adminClient, 'automation_nodes', orgId, errors)
    await safeDelete(adminClient, 'automations', orgId, errors)

    // ── Phase 2: Follow-up tables ──
    console.log('Phase 2: Follow-up cleanup...')
    await safeDelete(adminClient, 'follow_up_webhook_log', orgId, errors)
    await safeDelete(adminClient, 'follow_up_queue', orgId, errors)
    await safeDelete(adminClient, 'lead_follow_up_tracking', orgId, errors)
    await safeDelete(adminClient, 'follow_up_step_messages', orgId, errors)
    await safeDelete(adminClient, 'follow_up_steps', orgId, errors)
    await safeDelete(adminClient, 'follow_up_sequence_triggers', orgId, errors)
    await safeDelete(adminClient, 'follow_up_sequences', orgId, errors)

    // ── Phase 3: Broadcast tables ──
    console.log('Phase 3: Broadcast cleanup...')
    await safeDelete(adminClient, 'broadcast_campaigns', orgId, errors)
    await safeDelete(adminClient, 'broadcast_lists', orgId, errors)
    await safeDelete(adminClient, 'broadcast_message_templates', orgId, errors)

    // ── Phase 4: Tag-related tables ──
    console.log('Phase 4: Tags cleanup...')
    await safeDelete(adminClient, 'chat_tags_history', orgId, errors)
    await safeDelete(adminClient, 'chat_tags', orgId, errors)
    await safeDelete(adminClient, 'message_tag_rules', orgId, errors)
    await safeDelete(adminClient, 'tag_group_members', orgId, errors)
    await safeDelete(adminClient, 'tag_groups', orgId, errors)
    await safeDelete(adminClient, 'analytics_config', orgId, errors)

    // ── Phase 5: Funnel tables (children before parents) ──
    console.log('Phase 5: Funnel cleanup...')
    await safeDelete(adminClient, 'chat_funnel_stage', orgId, errors)
    await safeDelete(adminClient, 'funnel_members', orgId, errors)
    await safeDelete(adminClient, 'funnel_stages', orgId, errors)
    await safeDelete(adminClient, 'funnels', orgId, errors)

    // ── Phase 6: Chat-dependent tables ──
    console.log('Phase 6: Chat-dependent cleanup...')
    await safeDelete(adminClient, 'slash_command_executions', orgId, errors)
    await safeDelete(adminClient, 'slash_command_steps', orgId, errors)
    await safeDelete(adminClient, 'slash_commands', orgId, errors)
    await safeDelete(adminClient, 'scheduled_messages', orgId, errors)
    await safeDelete(adminClient, 'chat_reads', orgId, errors)
    await safeDelete(adminClient, 'chat_resolutions', orgId, errors)
    await safeDelete(adminClient, 'chat_assignment_history', orgId, errors)
    await safeDelete(adminClient, 'chat_custom_field_values', orgId, errors)
    await safeDelete(adminClient, 'chat_custom_fields', orgId, errors)
    await safeDelete(adminClient, 'group_participants', orgId, errors)
    await safeDelete(adminClient, 'lead_files', orgId, errors)
    await safeDelete(adminClient, 'tasks', orgId, errors)

    // ── Phase 7: Calendar / Booking ──
    console.log('Phase 7: Calendar/Booking cleanup...')
    await safeDelete(adminClient, 'bookings', orgId, errors)
    await safeDelete(adminClient, 'booking_config', orgId, errors)
    await safeDelete(adminClient, 'calendar_events', orgId, errors)
    await safeDelete(adminClient, 'calendars', orgId, errors)

    // ── Phase 8: Financial / Tokens ──
    console.log('Phase 8: Financial cleanup...')
    await safeDelete(adminClient, 'transactions', orgId, errors)
    await safeDelete(adminClient, 'clients', orgId, errors)
    await safeDelete(adminClient, 'payment_history', orgId, errors)
    await safeDelete(adminClient, 'organization_token_balances', orgId, errors)
    await safeDelete(adminClient, 'token_transactions', orgId, errors)
    await safeDelete(adminClient, 'pending_token_purchases', orgId, errors)

    // ── Phase 9: Misc org-level tables ──
    console.log('Phase 9: Misc cleanup...')
    await safeDelete(adminClient, 'ai_prompts', orgId, errors)
    await safeDelete(adminClient, 'bot_settings', orgId, errors)
    await safeDelete(adminClient, 'google_calendar_config', orgId, errors)
    await safeDelete(adminClient, 'google_connections', orgId, errors)
    await safeDelete(adminClient, 'meta_connections', orgId, errors)
    await safeDelete(adminClient, 'organization_auto_messages', orgId, errors)
    await safeDelete(adminClient, 'organization_modules', orgId, errors)
    await safeDelete(adminClient, 'organization_connections', orgId, errors)
    await safeDelete(adminClient, 'system_config', orgId, errors)
    await safeDelete(adminClient, 'webhook_configs', orgId, errors)
    await safeDelete(adminClient, 'whatsapp_connections', orgId, errors)
    await safeDelete(adminClient, 'ai_agent_credentials', orgId, errors)
    await safeDelete(adminClient, 'ai_agent_memory', orgId, errors)
    await safeDelete(adminClient, 'ghl_connections', orgId, errors)
    await safeDelete(adminClient, 'ghl_global_config', orgId, errors)
    await safeDelete(adminClient, 'ghl_sync_mappings', orgId, errors)
    await safeDelete(adminClient, 'ghl_sync_logs', orgId, errors)
    await safeDelete(adminClient, 'tags', orgId, errors) // after all tag refs gone

    // ── Phase 10: Clear message self-references then batch delete ──
    console.log('Phase 10: Messages cleanup...')
    // Clear quoted_message_id
    let cleared = 0
    while (true) {
      const { data: rows } = await adminClient
        .from('messages')
        .select('id')
        .eq('organization_id', orgId)
        .not('quoted_message_id', 'is', null)
        .limit(500)
      if (!rows || rows.length === 0) break
      const ids = rows.map((r: any) => r.id)
      await adminClient.from('messages').update({ quoted_message_id: null } as any).in('id', ids)
      cleared += ids.length
      console.log(`Cleared ${cleared} quoted references`)
      if (rows.length < 500) break
    }

    const msgErr = await batchDelete(adminClient, 'messages', orgId)
    if (msgErr) errors.push(msgErr)

    // ── Phase 11: Chats ──
    console.log('Phase 11: Chats cleanup...')
    const chatErr = await batchDelete(adminClient, 'chats', orgId)
    if (chatErr) errors.push(chatErr)

    // ── Phase 12: Teams ──
    console.log('Phase 12: Teams cleanup...')
    await safeDelete(adminClient, 'team_members', orgId, errors)
    await safeDelete(adminClient, 'teams', orgId, errors)

    // ── Phase 13: User data ──
    console.log('Phase 13: User data cleanup...')
    await safeDelete(adminClient, 'user_presence', orgId, errors)

    // Clean user_organizations pivot table
    const { data: orgMemberships } = await adminClient
      .from('user_organizations')
      .select('user_id')
      .eq('organization_id', orgId)

    // Delete user_organizations entries for this org
    const { error: uoError } = await adminClient
      .from('user_organizations')
      .delete()
      .eq('organization_id', orgId)
    if (uoError) errors.push(`user_organizations: ${uoError.message}`)

    const { data: orgProfiles, error: orgProfilesError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId)

    if (orgProfilesError) {
      errors.push(`profiles(select): ${orgProfilesError.message}`)
    }

    if (orgProfiles && orgProfiles.length > 0) {
      const userIds = orgProfiles.map((p: any) => p.id)

      for (const uid of userIds) {
        if (uid === userId) continue // Skip requesting super admin

        // Check if user belongs to other organizations
        const { data: otherOrgs } = await adminClient
          .from('user_organizations')
          .select('organization_id')
          .eq('user_id', uid)

        if (otherOrgs && otherOrgs.length > 0) {
          // User belongs to other orgs — just detach from this org, don't delete
          console.log(`User ${uid} has ${otherOrgs.length} other orgs, detaching only`)
          await adminClient.from('profiles').update({ organization_id: otherOrgs[0].organization_id } as any).eq('id', uid)
        } else {
          // User belongs to no other orgs — safe to delete entirely
          const { error: permsError } = await adminClient
            .from('user_page_permissions')
            .delete()
            .eq('user_id', uid)
          if (permsError) errors.push(`user_page_permissions(${uid}): ${permsError.message}`)

          const { error: rolesError } = await adminClient
            .from('user_roles')
            .delete()
            .eq('user_id', uid)
          if (rolesError) errors.push(`user_roles(${uid}): ${rolesError.message}`)

          const { error: profileDeleteError } = await adminClient
            .from('profiles')
            .delete()
            .eq('id', uid)
          if (profileDeleteError) errors.push(`profiles(${uid}): ${profileDeleteError.message}`)

          try {
            const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(uid)
            if (authDeleteError) {
              console.error(`Failed to delete auth user ${uid}:`, authDeleteError.message)
              errors.push(`auth_user(${uid}): ${authDeleteError.message}`)
            } else {
              console.log(`Deleted auth user ${uid}`)
            }
          } catch (e: any) {
            errors.push(`auth_user(${uid}): ${e.message}`)
          }
        }
      }
    }

    // ── Phase 14: Delete organization ──
    console.log('Phase 14: Deleting organization...')
    const { error: orgError } = await adminClient.from('organizations').delete().eq('id', orgId)
    if (orgError) {
      return new Response(JSON.stringify({ error: `Failed to delete organization: ${orgError.message}`, partial_errors: errors }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Organization deleted successfully!')
    return new Response(JSON.stringify({ success: true, warnings: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})