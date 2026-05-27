/**
 * meta-leadgen-kanban.ts
 * Adaptador responsável por receber dados de um lead Meta (formulário nativo / Lead Ad)
 * e persistir no sistema: upsert em contacts + insert em kanban_leads.
 *
 * API: Meta Graph API v21.0
 * Auth: access_token por empresa (marketing_credentials)
 * Erros conhecidos: 190 (token expirado), 100 (permissão insuficiente)
 */

import { db } from '@/lib/db';
import { contacts, kanbanLeads, kanbanBoards, companies, marketingCredentials } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { emitToCompany } from '@/lib/socket';

export interface LeadFieldItem {
  name: string;
  values: string[];
}

export interface LeadMetaData {
  leadgenId: string;
  formId?: string | null;
  formName?: string | null;
  adId?: string | null;
  adsetId?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  pageId?: string | null;
  fieldData: LeadFieldItem[];
}

/**
 * Normaliza telefone para o formato internacional.
 * Garante 13 dígitos (55 + DDD + número).
 */
export function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return null;
  const withCountry = digits.length >= 10 && digits.length <= 11 ? '55' + digits : digits;
  return withCountry.slice(-13);
}

/**
 * Extrai campos padrão do fieldData do Meta Lead Form.
 * Suporta campos em PT e EN.
 */
export function extractLeadFields(fieldData: LeadFieldItem[]): {
  nome: string | null;
  telefone: string | null;
  email: string | null;
  extraFields: Record<string, string>;
} {
  let nome: string | null = null;
  let telefone: string | null = null;
  let email: string | null = null;
  const extraFields: Record<string, string> = {};

  for (const field of fieldData) {
    const key = field.name.toLowerCase();
    const val = field.values?.[0] || null;
    if (!val) continue;

    if (['full_name', 'nome', 'name'].includes(key)) nome = val;
    else if (['phone_number', 'telefone', 'phone', 'celular', 'whatsapp'].includes(key)) telefone = val;
    else if (['email', 'e-mail', 'email_address'].includes(key)) email = val;
    else extraFields[field.name] = val;
  }

  return { nome, telefone, email, extraFields };
}

/**
 * Monta o customFields para o contato a partir dos dados do formulário Meta.
 * Formato: { "Meta: Campo": "valor", ... }
 * Isso permite visualizar no Kanban o que o lead preencheu.
 */
function buildCustomFields(
  fieldData: LeadFieldItem[],
  formName: string | null,
  formId: string | null,
  adId: string | null,
  campaignName: string | null,
): Record<string, string> {
  const cf: Record<string, string> = {};

  if (formName) cf['Meta: Formulário'] = formName;
  else if (formId) cf['Meta: Form ID'] = formId;
  if (campaignName) cf['Meta: Campanha'] = campaignName;
  if (adId) cf['Meta: Anúncio ID'] = adId;
  cf['Meta: Origem'] = 'Formulário Nativo';

  // Campos personalizados do formulário (tudo que não é nome/tel/email)
  const KNOWN_FIELDS = new Set(['full_name', 'nome', 'name', 'phone_number', 'telefone', 'phone', 'celular', 'whatsapp', 'email', 'e-mail', 'email_address']);
  for (const field of fieldData) {
    const key = field.name.toLowerCase();
    const val = field.values?.[0];
    if (!KNOWN_FIELDS.has(key) && val) {
      // Capitaliza o nome do campo para exibição
      const displayKey = field.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      cf[displayKey] = val;
    }
  }

  return cf;
}

/**
 * Busca o token de acesso e configurações de leadgen para a empresa.
 */
async function getCompanyMetaConfig(companyId: string): Promise<{
  accessToken: string;
  defaultBoardId: string | null;
  leadgenConfig: LeadgenRoutingConfig | null;
} | null> {
  const [company] = await db.select({
    defaultKanbanBoardId: companies.defaultKanbanBoardId,
  }).from(companies).where(eq(companies.id, companyId)).limit(1);

  if (!company) return null;

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
  const leadgenConfig = credentials.leadgen_config as LeadgenRoutingConfig | null;

  if (!accessToken) return null;

  return {
    accessToken,
    defaultBoardId: company.defaultKanbanBoardId,
    leadgenConfig: leadgenConfig || null,
  };
}

/**
 * Estrutura de configuração de roteamento de formulários.
 * Salvo em marketing_credentials.credentials.leadgen_config
 */
export interface LeadgenFormMapping {
  formId: string;
  formName?: string;
  boardId: string;
  stageId: string;
}

export interface LeadgenRoutingConfig {
  defaultBoardId?: string;
  defaultStageId?: string;
  formMappings?: LeadgenFormMapping[];
}

/**
 * Resolve qual board e stage usar para um dado formId,
 * consultando a config de roteamento.
 */
export function resolveRoutingTarget(
  formId: string | null | undefined,
  config: LeadgenRoutingConfig | null,
  fallbackBoardId: string | null,
): { boardId: string | null; stageId: string | null } {
  if (!config) return { boardId: fallbackBoardId, stageId: null };

  // Mapeamento específico por formulário
  if (formId && config.formMappings?.length) {
    const mapping = config.formMappings.find(m => m.formId === formId);
    if (mapping) {
      return { boardId: mapping.boardId, stageId: mapping.stageId };
    }
  }

  // Configuração padrão
  if (config.defaultBoardId) {
    return {
      boardId: config.defaultBoardId,
      stageId: config.defaultStageId || null,
    };
  }

  return { boardId: fallbackBoardId, stageId: null };
}

/**
 * Busca o primeiro estágio (não WIN / não LOSS) de um kanban board,
 * ou um estágio específico se stageId for fornecido.
 */
async function resolveStage(
  boardId: string,
  preferredStageId?: string | null,
): Promise<{ stageId: string; stage: any } | null> {
  const [board] = await db.select({ stages: kanbanBoards.stages })
    .from(kanbanBoards)
    .where(eq(kanbanBoards.id, boardId))
    .limit(1);

  if (!board?.stages || !Array.isArray(board.stages) || board.stages.length === 0) return null;

  // Usa estágio configurado se existir no board
  if (preferredStageId) {
    const found = board.stages.find((s: any) => s.id === preferredStageId);
    if (found) return { stageId: found.id, stage: found };
  }

  // Fallback: primeiro estágio que não é WIN nem LOSS
  const entryStage = board.stages.find((s: any) => s.type !== 'WIN' && s.type !== 'LOSS');
  if (!entryStage) return null;

  return { stageId: entryStage.id, stage: entryStage };
}

/**
 * Upsert de contato por telefone normalizado.
 * Salva campos do formulário em customFields.
 */
async function upsertContact(
  companyId: string,
  nome: string | null,
  telefone: string | null,
  email: string | null,
  customFields: Record<string, string>,
): Promise<{ id: string; phone: string } | null> {
  if (!telefone) {
    console.warn('[meta-leadgen-kanban] Lead sem telefone — impossível criar contato');
    return null;
  }

  const normalizedPhone = normalizePhone(telefone);
  if (!normalizedPhone) return null;

  const phoneVariants = [normalizedPhone, telefone.replace(/\D/g, '')];
  const [existing] = await db.select({ id: contacts.id, phone: contacts.phone, name: contacts.name, email: contacts.email, customFields: contacts.customFields })
    .from(contacts)
    .where(and(
      eq(contacts.companyId, companyId),
      inArray(contacts.phone, phoneVariants)
    ))
    .limit(1);

  if (existing) {
    // Mescla customFields: mantém os existentes + adiciona os novos do formulário
    const mergedCustomFields = { ...(existing.customFields || {}), ...customFields };
    const updates: any = { customFields: mergedCustomFields };

    const isGenericName = existing.name && /^\d+$/.test(existing.name.replace(/\D/g, ''));
    if (isGenericName && nome) updates.name = nome;
    if (!existing.email && email) updates.email = email;

    await db.update(contacts).set(updates).where(
      and(eq(contacts.id, existing.id), eq(contacts.companyId, companyId))
    );
    return { id: existing.id, phone: existing.phone };
  }

  // Cria novo contato com customFields do formulário
  const [newContact] = await db.insert(contacts).values({
    companyId,
    name: nome || normalizedPhone,
    phone: normalizedPhone,
    email: email || undefined,
    status: 'ACTIVE',
    customFields,
  }).returning({ id: contacts.id, phone: contacts.phone });

  return newContact || null;
}

/**
 * Verifica se já existe um kanban_lead ativo para este contato neste board.
 */
async function checkExistingKanbanLead(
  companyId: string,
  boardId: string,
  contactId: string,
): Promise<boolean> {
  const [existing] = await db.select({ id: kanbanLeads.id })
    .from(kanbanLeads)
    .where(and(
      eq(kanbanLeads.companyId, companyId),
      eq(kanbanLeads.boardId, boardId),
      eq(kanbanLeads.contactId, contactId),
      eq(kanbanLeads.status, 'ACTIVE')
    ))
    .limit(1);
  return !!existing;
}

/**
 * Ponto de entrada principal: persiste um lead de formulário nativo no Kanban.
 *
 * @param companyId - ID da empresa (tenant)
 * @param leadData - Dados do lead extraídos do webhook Meta + Graph API
 * @param boardId - (opcional) Board de destino (sobrescreve config)
 * @param stageId - (opcional) Estágio de destino (sobrescreve config)
 */
export async function persistLeadInKanban(
  companyId: string,
  leadData: LeadMetaData,
  boardId?: string,
  stageId?: string,
): Promise<{ ok: boolean; kanbanLeadId?: string; reason?: string }> {
  try {
    const config = await getCompanyMetaConfig(companyId);
    if (!config) {
      return { ok: false, reason: 'Meta não conectado para esta empresa' };
    }

    // Resolver board e stage via config (se não fornecido explicitamente)
    let targetBoardId = boardId;
    let targetStageId = stageId;

    if (!targetBoardId) {
      const routing = resolveRoutingTarget(leadData.formId, config.leadgenConfig, config.defaultBoardId);
      targetBoardId = routing.boardId ?? undefined;
      targetStageId = targetStageId || routing.stageId || undefined;
    }

    if (!targetBoardId) {
      return { ok: false, reason: 'Nenhum Kanban Board configurado. Configure em Marketing → Formulários.' };
    }

    // Extrair campos do formulário
    const { nome, telefone, email, extraFields } = extractLeadFields(leadData.fieldData);

    // Montar customFields para o contato
    const customFields = buildCustomFields(
      leadData.fieldData,
      leadData.formName || null,
      leadData.formId || null,
      leadData.adId || null,
      leadData.campaignName || null,
    );

    // Upsert contato
    const contact = await upsertContact(companyId, nome, telefone, email, customFields);
    if (!contact) {
      return { ok: false, reason: 'Lead sem telefone — não foi possível criar contato' };
    }

    // Verificar duplicata
    const alreadyExists = await checkExistingKanbanLead(companyId, targetBoardId, contact.id);
    if (alreadyExists) {
      console.log(`[meta-leadgen-kanban] Duplicata ignorada (board=${targetBoardId}, contact=${contact.id})`);
      return { ok: true, reason: 'duplicate_skipped' };
    }

    // Resolver estágio
    const stageInfo = await resolveStage(targetBoardId, targetStageId);
    if (!stageInfo) {
      return { ok: false, reason: `Board ${targetBoardId} não tem estágios configurados` };
    }

    // Construir notes com campos extras do formulário (legível no card)
    const title = nome || telefone || 'Lead via Formulário Meta';
    const noteLines: string[] = [];
    if (leadData.formName) noteLines.push(`📝 Formulário: ${leadData.formName}`);
    for (const [k, v] of Object.entries(extraFields)) {
      noteLines.push(`${k}: ${v}`);
    }
    const notes = noteLines.length > 0 ? noteLines.join('\n') : null;

    // Inserir kanban_lead
    const [newLead] = await db.insert(kanbanLeads).values({
      companyId,
      boardId: targetBoardId,
      stageId: stageInfo.stageId,
      contactId: contact.id,
      title,
      notes: notes ?? undefined,
      currentStage: stageInfo.stage,
      externalId: leadData.leadgenId,
      externalProvider: 'meta_leadgen',
      status: 'ACTIVE',
    }).returning({ id: kanbanLeads.id });

    if (!newLead) {
      return { ok: false, reason: 'Falha ao inserir kanban_lead no banco' };
    }

    console.log(`[meta-leadgen-kanban] ✅ Lead ${leadData.leadgenId} → Kanban (board=${targetBoardId}, stage=${stageInfo.stageId})`);

    // Emitir evento real-time
    try {
      emitToCompany(companyId, 'kanban:lead-created', {
        boardId: targetBoardId,
        stageId: stageInfo.stageId,
        leadId: newLead.id,
        contactId: contact.id,
        title,
        source: 'meta_leadform',
        formName: leadData.formName || null,
      });
    } catch (socketErr) {
      console.warn('[meta-leadgen-kanban] Socket emit falhou:', socketErr);
    }

    return { ok: true, kanbanLeadId: newLead.id };
  } catch (err: any) {
    console.error('[meta-leadgen-kanban] Erro inesperado:', err.message);
    return { ok: false, reason: err.message };
  }
}
