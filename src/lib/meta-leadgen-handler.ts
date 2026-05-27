/**
 * meta-leadgen-handler.ts
 * Handler multi-tenant para eventos de leadgen do Meta (formulários nativos / Lead Ads).
 *
 * API: Meta Graph API v21.0
 * Auth: access_token por empresa (marketing_credentials — nunca env vars globais)
 * Fluxo: webhook page/leadgen → fetch lead details → resolveRouting → persistLeadInKanban
 */

import { db } from '@/lib/db';
import { marketingCredentials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { persistLeadInKanban, LeadgenRoutingConfig, resolveRoutingTarget } from '@/lib/meta-leadgen-kanban';

const META_BASE = 'https://graph.facebook.com/v21.0';

interface LeadgenValue {
  leadgen_id: string;
  ad_id?: string;
  form_id?: string;
  page_id?: string;
  adgroup_id?: string;
  created_time?: number;
}

interface FieldDataItem {
  name: string;
  values: string[];
}

interface MetaLeadResponse {
  id: string;
  created_time?: string;
  ad_id?: string;
  ad_group_id?: string;
  campaign_id?: string;
  form_id?: string;
  field_data?: FieldDataItem[];
  error?: { message: string; code?: number; type?: string; fbtrace_id?: string };
}

interface MetaFormDetails {
  id: string;
  name?: string;
  status?: string;
}

/**
 * Busca o access_token e a config de leadgen da empresa.
 * Usa marketing_credentials (multi-tenant) — nunca env vars globais.
 */
async function getCompanyMetaCredentials(companyId: string): Promise<{
  accessToken: string;
  leadgenConfig: LeadgenRoutingConfig | null;
} | null> {
  const [cred] = await db.select().from(marketingCredentials).where(
    and(
      eq(marketingCredentials.companyId, companyId),
      eq(marketingCredentials.platform, 'meta'),
      eq(marketingCredentials.status, 'connected')
    )
  ).limit(1);

  if (!cred?.credentials) return null;

  // external-api: untyped — Meta OAuth credentials
  const credentials = cred.credentials as any;
  const accessToken = credentials.access_token;
  if (!accessToken) return null;

  const leadgenConfig = (credentials.leadgen_config as LeadgenRoutingConfig) || null;

  return { accessToken, leadgenConfig };
}

/**
 * Busca os detalhes de um lead na Graph API.
 */
async function fetchLeadDetails(
  leadgenId: string,
  accessToken: string,
): Promise<MetaLeadResponse | null> {
  const fields = 'id,created_time,ad_id,ad_group_id,campaign_id,form_id,field_data';
  try {
    const res = await fetch(`${META_BASE}/${leadgenId}?fields=${fields}&access_token=${accessToken}`);
    const data: MetaLeadResponse = await res.json();

    if (!data.error) return data;

    console.error(`[meta-leadgen] ❌ Erro ao buscar lead ${leadgenId}:`, {
      code: data.error.code,
      type: data.error.type,
      message: data.error.message,
    });

    if (data.error.code === 100 || data.error.code === 190 || data.error.code === 200) {
      console.error(`[meta-leadgen] 🔐 Verificar permissão 'leads_retrieval' e validade do token.`);
    }
    return null;
  } catch (err: any) {
    console.error(`[meta-leadgen] ❌ Erro de rede ao buscar lead ${leadgenId}:`, err.message);
    return null;
  }
}

/**
 * Busca o nome de um formulário específico na Graph API.
 */
async function fetchFormName(
  formId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${META_BASE}/${formId}?fields=id,name&access_token=${accessToken}`);
    const data: MetaFormDetails = await res.json();
    return (data as any).error ? null : (data.name || null);
  } catch {
    return null;
  }
}

/**
 * Ponto de entrada: processa um payload de webhook Meta do tipo page/leadgen.
 * Lê a configuração de roteamento (leadgen_config) para saber em qual board/estágio inserir.
 */
export async function handleLeadgenWebhook(
  entries: any[],
  companyId: string,
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  const metaCreds = await getCompanyMetaCredentials(companyId);
  if (!metaCreds) {
    const msg = `[meta-leadgen] Empresa ${companyId} sem Meta conectado`;
    console.warn(msg);
    return { processed: 0, errors: [msg] };
  }

  const { accessToken, leadgenConfig } = metaCreds;

  for (const entry of entries) {
    const changes: any[] = entry.changes || [];

    for (const change of changes) {
      if (change.field !== 'leadgen') continue;

      const value: LeadgenValue = change.value;
      if (!value?.leadgen_id) continue;

      try {
        console.log(`[meta-leadgen] Processando lead ${value.leadgen_id} (form=${value.form_id}, empresa=${companyId})`);

        // Buscar dados do lead na Graph API
        const lead = await fetchLeadDetails(value.leadgen_id, accessToken);
        if (!lead) {
          errors.push(`Falha ao buscar lead ${value.leadgen_id} — verifique permissão 'leads_retrieval'`);
          continue;
        }

        // Buscar nome do formulário para exibição amigável
        const resolvedFormId = lead.form_id || value.form_id;
        let formName: string | null = null;
        if (resolvedFormId) {
          formName = await fetchFormName(resolvedFormId, accessToken);
        }

        // Resolver roteamento via config (board + stage por formId)
        const routing = resolveRoutingTarget(resolvedFormId, leadgenConfig, null);

        // Persistir no Kanban com board/stage resolvidos
        const result = await persistLeadInKanban(
          companyId,
          {
            leadgenId: value.leadgen_id,
            formId: resolvedFormId || null,
            formName,
            adId: lead.ad_id || value.ad_id || null,
            adsetId: lead.ad_group_id || value.adgroup_id || null,
            campaignId: lead.campaign_id || null,
            pageId: value.page_id || null,
            fieldData: lead.field_data || [],
          },
          routing.boardId || undefined,
          routing.stageId || undefined,
        );

        if (result.ok) {
          if (result.reason !== 'duplicate_skipped') {
            console.log(`[meta-leadgen] ✅ Lead ${value.leadgen_id} → kanban_lead ${result.kanbanLeadId}`);
          }
          processed++;
        } else {
          errors.push(`Lead ${value.leadgen_id}: ${result.reason}`);
          console.error(`[meta-leadgen] ❌ Falha ao persistir lead:`, result.reason);
        }
      } catch (err: any) {
        const msg = `Erro ao processar lead ${value.leadgen_id}: ${err.message}`;
        errors.push(msg);
        console.error(`[meta-leadgen] ❌ ${msg}`);
      }
    }
  }

  return { processed, errors };
}
