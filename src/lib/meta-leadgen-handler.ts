import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface LeadgenValue {
  leadgen_id: string
  ad_id?: string
  form_id?: string
  page_id?: string
  created_time?: number
}

interface FieldDataItem {
  name: string
  values: string[]
}

interface MetaLeadResponse {
  id: string
  created_time?: string
  ad_id?: string
  ad_group_id?: string
  campaign_id?: string
  form_id?: string
  field_data?: FieldDataItem[]
  error?: { message: string; code?: number; type?: string; fbtrace_id?: string }
}

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 0) return null
  const withCountry = digits.length >= 10 && digits.length <= 11 ? '55' + digits : digits
  return withCountry.slice(-13)
}

export async function handleLeadgenWebhook(entries: any[]): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = []
  let processed = 0

  for (const entry of entries) {
    const changes = entry.changes || []
    for (const change of changes) {
      const value: LeadgenValue = change.value
      if (!value?.leadgen_id) continue

      try {
        // Fetch lead details from Meta — try Page token first, then System User token as fallback
        const pageToken = process.env.META_PAGE_ACCESS_TOKEN
        const adsToken = process.env.META_ADS_ACCESS_TOKEN

        if (!pageToken && !adsToken) {
          errors.push(`No META_PAGE_ACCESS_TOKEN or META_ADS_ACCESS_TOKEN configured`)
          continue
        }

        const leadFields = 'id,created_time,ad_id,ad_group_id,campaign_id,form_id,field_data'
        let lead: MetaLeadResponse | null = null
        let tokenUsed = ''

        // Attempt A — Page Access Token
        if (pageToken) {
          const resA = await fetch(
            `https://graph.facebook.com/v21.0/${value.leadgen_id}?fields=${leadFields}&access_token=${pageToken}`
          )
          const dataA: MetaLeadResponse = await resA.json()

          if (!dataA.error) {
            lead = dataA
            tokenUsed = 'META_PAGE_ACCESS_TOKEN'
            console.log(`[meta-leadgen] Lead ${value.leadgen_id} fetched with META_PAGE_ACCESS_TOKEN`)
          } else {
            console.warn(`[meta-leadgen] Page token failed for ${value.leadgen_id}:`, JSON.stringify(dataA.error))
          }
        }

        // Attempt B — System User Token (fallback)
        if (!lead && adsToken) {
          const resB = await fetch(
            `https://graph.facebook.com/v21.0/${value.leadgen_id}?fields=${leadFields}&access_token=${adsToken}`
          )
          const dataB: MetaLeadResponse = await resB.json()

          if (!dataB.error) {
            lead = dataB
            tokenUsed = 'META_ADS_ACCESS_TOKEN'
            console.log(`[meta-leadgen] Lead ${value.leadgen_id} fetched with META_ADS_ACCESS_TOKEN (fallback)`)
          } else {
            console.warn(`[meta-leadgen] Ads token also failed for ${value.leadgen_id}:`, JSON.stringify(dataB.error))
          }
        }

        // Both tokens failed — capture actual Meta API error for diagnosis
        if (!lead) {
          // Re-fetch to capture the actual error response
          let metaError: any = null
          const diagToken = pageToken || adsToken
          if (diagToken) {
            try {
              const diagRes = await fetch(
                `https://graph.facebook.com/v21.0/${value.leadgen_id}?fields=id&access_token=${diagToken}`
              )
              const diagData = await diagRes.json()
              metaError = diagData.error || null
            } catch (_) { /* ignore */ }
          }
          const errorDetail = {
            leadgen_id: value.leadgen_id,
            page_id: value.page_id,
            meta_error: metaError ? { code: metaError.code, type: metaError.type, message: metaError.message } : 'unknown',
            page_token_prefix: pageToken ? pageToken.slice(0, 10) + '...' : 'not set',
            ads_token_prefix: adsToken ? adsToken.slice(0, 10) + '...' : 'not set',
          }
          console.error(`[meta-leadgen] ERROR — both tokens failed:`, JSON.stringify(errorDetail))

          // Log to n8n_error_log for visibility
          await supabaseAdmin.from('n8n_error_log').insert({
            tipo: 'leadgen_permission_error',
            error_message: `Both tokens failed for leadgen_id ${value.leadgen_id} | ${JSON.stringify(errorDetail)}`,
            workflow_name: 'meta-leadgen-webhook',
            node_name: 'fetchLeadDetails',
            resolved: false,
          }).then(({ error: dbErr }) => {
            if (dbErr) console.error('[meta-leadgen] Failed to log error to n8n_error_log:', dbErr.message)
          })

          errors.push(`Both tokens failed for leadgen_id ${value.leadgen_id} — permission error, no retry`)
          continue
        }

        // Extract fields
        const fieldData = lead.field_data || []
        let telefone: string | null = null
        let nome: string | null = null
        let email: string | null = null

        for (const field of fieldData) {
          const name = field.name.toLowerCase()
          const val = field.values?.[0] || null
          if (name === 'phone_number' || name === 'telefone') telefone = val
          if (name === 'full_name' || name === 'nome') nome = val
          if (name === 'email') email = val
        }

        const telefoneNorm = normalizePhone(telefone)

        // Match in leads_crm by normalized phone (last 24h)
        let matchedLead: { id: string; ad_id: string | null; ghl_created_at: string | null } | null = null
        if (telefoneNorm) {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          const { data } = await supabaseAdmin
            .from('leads_crm')
            .select('id, ad_id, ghl_created_at')
            .eq('telefone_normalizado', telefoneNorm)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(1)

          if (data && data.length > 0) {
            matchedLead = data[0]
          }
        }

        const adId = lead.ad_id || value.ad_id || null
        const adsetId = lead.ad_group_id || null
        const campaignId = lead.campaign_id || null
        const formId = lead.form_id || value.form_id || null

        if (matchedLead && !matchedLead.ad_id && adId) {
          // ENRICH existing lead
          const updatePayload: Record<string, any> = {
            ad_id: adId,
            adset_id: adsetId,
            campaign_id: campaignId,
            form_id: formId,
            leadgen_id: value.leadgen_id,
            meta_field_data: fieldData,
            origem_canal: 'formulario_meta',
            atribuicao_tier: 1,
          }
          // Preencher ghl_created_at se estiver null (leads do GHL sem data)
          if (!(matchedLead as any).ghl_created_at) {
            updatePayload.ghl_created_at = new Date().toISOString()
          }
          await supabaseAdmin
            .from('leads_crm')
            .update(updatePayload)
            .eq('id', matchedLead.id)

          processed++
        } else if (matchedLead && matchedLead.ad_id) {
          // Already attributed - skip (don't overwrite CTWA attribution)
          processed++
        } else {
          // No match - INSERT directly
          const nowIso = new Date().toISOString()
          const mesRef = nowIso.slice(0, 7) // YYYY-MM
          await supabaseAdmin.from('leads_crm').insert({
            nome,
            telefone,
            telefone_normalizado: telefoneNorm,
            email,
            ad_id: adId,
            adset_id: adsetId,
            campaign_id: campaignId,
            form_id: formId,
            leadgen_id: value.leadgen_id,
            meta_field_data: fieldData,
            origem_canal: 'formulario_meta',
            atribuicao_tier: 1,
            mes_referencia: mesRef,
            ghl_created_at: nowIso,
          })
          processed++
        }
      } catch (err: any) {
        errors.push(`Error processing ${value.leadgen_id}: ${err.message}`)
      }
    }
  }

  return { processed, errors }
}
