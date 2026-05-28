/**
 * POST /api/meta/leadforms/[formId]/simulate-lead
 *
 * Simula a entrada de um lead do formulário Meta no sistema.
 * Usado para testar o roteamento Kanban sem esperar por um lead real.
 *
 * 1. Busca as perguntas reais do formulário na Meta API
 * 2. Gera field_data falso mas realista
 * 3. Chama persistLeadInKanban diretamente
 * 4. Retorna o resultado completo com IDs criados
 *
 * Aceita body JSON opcional: { phoneFieldKey?: string }
 * para testar com campo de telefone customizado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMetaAuthForSession, META_BASE } from '@/lib/meta-ads';
import { persistLeadInKanban } from '@/lib/meta-leadgen-kanban';
import { getCompanyIdFromSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

interface MetaQuestion {
  key: string;
  label: string;
  type: string;
  options?: string[];
}

/** Gera valor de teste por tipo de campo */
function fakeValue(q: MetaQuestion): string {
  const key = q.key.toLowerCase();
  const label = (q.label || '').toLowerCase();

  // Campos padrão Meta
  if (key === 'full_name') return 'Lead Teste Simulado';
  if (key === 'email' || key === 'email_address') return 'lead.teste@simulacao.com.br';
  if (['phone_number', 'telefone', 'phone', 'celular', 'whatsapp'].includes(key)) return '11999887766';

  // Heurística para campos customizados de telefone
  if (label.includes('whatsapp') || label.includes('telefone') || label.includes('número') || label.includes('numero')) {
    return '11988776655';
  }

  // Demais campos CUSTOM — resposta genérica baseada no label
  if (label.includes('desafio')) return 'Gerar mais leads qualificados';
  if (label.includes('posição') || label.includes('cargo')) return 'Diretor Comercial';
  if (label.includes('colaborador') || label.includes('funcionário') || label.includes('equipe')) return '10 a 50';
  if (label.includes('faturamento') || label.includes('receita')) return 'R$ 100k a R$ 500k/mês';
  if (label.includes('empresa')) return 'Empresa Teste Ltda';
  if (label.includes('cidade') || label.includes('estado')) return 'São Paulo';

  // Múltipla escolha — pega primeira opção
  if (q.options && q.options.length > 0) return q.options[0];

  return 'Resposta de teste';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const { formId } = await params;
    if (!formId) {
      return NextResponse.json({ error: 'formId obrigatório' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const phoneFieldKey: string | undefined = body.phoneFieldKey || undefined;

    const companyId = await getCompanyIdFromSession();
    const auth = await getMetaAuthForSession();

    // 1. Busca perguntas reais do formulário
    const qs = new URLSearchParams({ access_token: auth.token, fields: 'id,name,questions,status' });
    const formRes = await fetch(`${META_BASE}/${formId}?${qs}`, { cache: 'no-store' });
    const formData = await formRes.json();

    if (formData.error) {
      return NextResponse.json(
        { error: `Meta API: ${formData.error.message}`, code: formData.error.code },
        { status: 403 }
      );
    }

    const questions: MetaQuestion[] = (formData.questions || []).map((q: any) => ({
      key: q.key || q.name || '',
      label: q.label || q.key || '',
      type: q.type || 'CUSTOM',
      options: q.options?.map((o: any) => o.value || o) || [],
    }));

    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'Formulário sem perguntas ou sem permissão leads_retrieval' },
        { status: 400 }
      );
    }

    // 2. Gera field_data fake baseado nas perguntas reais
    const fieldData = questions.map(q => ({
      name: q.key,
      values: [fakeValue(q)],
    }));

    // Garante que o campo de telefone customizado existe nos dados
    if (phoneFieldKey && !fieldData.find(f => f.name === phoneFieldKey)) {
      fieldData.push({ name: phoneFieldKey, values: ['11977665544'] });
    }

    const simulatedLeadId = `sim_${Date.now()}`;

    // 3. Persiste no Kanban usando a lógica real de produção
    const result = await persistLeadInKanban(companyId, {
      leadgenId: simulatedLeadId,
      formId,
      formName: formData.name || 'Formulário Simulado',
      adId: null,
      adsetId: null,
      campaignId: null,
      campaignName: 'Simulação de Teste',
      pageId: null,
      fieldData,
    });

    return NextResponse.json({
      ok: result.ok,
      reason: result.reason,
      kanbanLeadId: result.kanbanLeadId,
      simulatedLeadId,
      formName: formData.name,
      fieldDataSent: fieldData,
      message: result.ok
        ? `✅ Lead simulado criado no Kanban (ID: ${result.kanbanLeadId})`
        : `❌ Falha: ${result.reason}`,
    });
  } catch (err: any) {
    console.error('[simulate-lead]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
