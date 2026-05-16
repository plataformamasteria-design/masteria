import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { automationRules } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { ruleId, nodeId, virtual_history, system_message, existing_notes } = body;

    if (!ruleId || !nodeId || !virtual_history || !Array.isArray(virtual_history) || virtual_history.length < 3) {
      return NextResponse.json({ message: 'Histórico insuficiente para gerar aprendizado' }, { status: 200 });
    }

    const resolvedKeys = await resolveAIKeys(session.user.companyId);
    const apiKey = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key missing' }, { status: 500 });
    }

    const formattedHistory = virtual_history
      .map((msg: any) => `${msg.role === 'user' ? 'LEAD' : 'I.A'}: ${msg.content}`)
      .join('\n');

    const openai = new OpenAI({ apiKey });
    
    const prompt = `Você é um supervisor de qualidade de I.A.
    
1. INSTRUÇÕES ORIGINAIS DA I.A:
${system_message || '(Sem instruções originais)'}

2. MEMÓRIA DE APRENDIZADO ATUAL:
${existing_notes || '(Nenhuma memória anterior)'}

3. ATENDIMENTO RECENTE:
${formattedHistory}

Com base no que a I.A já devia saber (1 e 2) e no que ela fez no atendimento recente (3), faça uma investigação profunda do comportamento dela.
Se ela errou algo que não estava nas instruções, ou se não seguiu algo que estava na memória, formule UMA ÚNICA NOTA (máx 2-3 frases) de aprendizado direto para ser ADICIONADA à memória dela na próxima vez.
A nota deve ser uma instrução direta e imperativa. Exemplo: "Nunca dê preços antes de perguntar o nome do cliente" ou "Você ignorou a instrução X, preste atenção nela."
Se o atendimento foi perfeito e não há absolutamente NADA a corrigir, responda exatamente "NADA A MELHORAR".`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.3,
    });

    const learnedNote = completion.choices[0]?.message?.content?.trim();
    const tokensUsed = completion.usage?.total_tokens || 0;

    if (!learnedNote || learnedNote === 'NADA A MELHORAR') {
      return NextResponse.json({ message: 'Nenhum aprendizado necessário gerado', tokens: tokensUsed }, { status: 200 });
    }

    const newNotes = existing_notes 
        ? `${existing_notes}\n- ${learnedNote}` 
        : `- ${learnedNote}`;

    // Se for uma automação nova que não foi salva ainda no DB
    if (ruleId === 'new') {
        return NextResponse.json({ success: true, learnedNote, fullNotes: newNotes, tokens: tokensUsed });
    }

    // Buscar a automação
    const rule = await db.query.automationRules.findFirst({
        where: and(
            eq(automationRules.id, ruleId),
            eq(automationRules.companyId, session.user.companyId)
        )
    });

    if (!rule || !rule.actions || !Array.isArray(rule.actions) || rule.actions.length === 0) {
        return NextResponse.json({ message: 'Regra ou ações não encontradas' }, { status: 404 });
    }

    // O fluxo JSON fica dentro de actions[0].value (como string JSON)
    let flowData: any = {};
    try {
        flowData = JSON.parse(rule.actions[0].value as string);
    } catch (e) {
        return NextResponse.json({ message: 'Erro ao parsear fluxo' }, { status: 500 });
    }

    if (!flowData.nodes) {
        return NextResponse.json({ message: 'Nós não encontrados no fluxo' }, { status: 404 });
    }

    const targetNode = flowData.nodes.find((n: any) => n.id === nodeId);
    if (!targetNode) {
        return NextResponse.json({ message: 'Nó do Agente IA não encontrado no fluxo' }, { status: 404 });
    }

    // Atualiza o learning_notes dentro do config do nó
    targetNode.data.config.learning_notes = newNotes;

    targetNode.data.config.learning_notes = newNotes;

    // Repacta o JSON
    const updatedActions = [...(rule.actions as any[])];
    updatedActions[0].value = JSON.stringify(flowData);

    // Salva no banco de dados
    await db.update(automationRules)
        .set({ actions: updatedActions as any })
        .where(eq(automationRules.id, ruleId));

    return NextResponse.json({ success: true, learnedNote, fullNotes: newNotes, tokens: tokensUsed });
  } catch (error) {
    console.error('[SimulatorMemory POST] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
