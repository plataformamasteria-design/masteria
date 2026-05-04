// src/data/insurance-plans.ts
// Tabela completa dos planos de Seguro de Vida Horizonte (Icatu Seguros)
// Valores base: Idade 37 anos | Data do estudo: 02/03/2026 | Nº Estudo: 1883982
// Corretor: Douglas Resende Teixeira da Silva

// ========================================
// TIPOS
// ========================================

export type PlanType = 'VIT' | 'VIT_TEMP';
export type Gender = 'feminino' | 'masculino';

export interface InsurancePlan {
    id: string;
    name: string;
    type: PlanType;
    gender: Gender;
    /** Indenização da cobertura vitalícia (R$) */
    coverageVitalicia: number;
    /** Indenização da cobertura temporária (R$) - 0 se não tem */
    coverageTemporaria: number;
    /** Indenização total (vitalícia + temporária) */
    totalCoverage: number;
    /** Pagamento mensal base - idade 37 (R$) */
    monthlyPayment: number;
    /** Pagamento anual base - idade 37 (R$) */
    annualPayment: number;
    /** Prazo de pagamento da cobertura vitalícia */
    paymentPeriodVit: string;
    /** Prazo da cobertura temporária (anos) - 0 se não tem */
    tempCoverageYears: number;
    /** Prazo de pagamento da cobertura básica (anos) - 0 para vitalício */
    paymentYearsVit: number;
    /** Descrição curta para o agente */
    description: string;
}

// ========================================
// PLANOS FEMININOS (5)
// ========================================

const femininePlans: InsurancePlan[] = [
    {
        id: 'fem-vit',
        name: 'Horizonte Feminino Vitalício',
        type: 'VIT',
        gender: 'feminino',
        coverageVitalicia: 1_000_000,
        coverageTemporaria: 0,
        totalCoverage: 1_000_000,
        monthlyPayment: 1091.16,
        annualPayment: 12570.13,
        paymentPeriodVit: 'Vitalício',
        tempCoverageYears: 0,
        paymentYearsVit: 0,
        description: 'Cobertura vitalícia de R$ 1 milhão com pagamento contínuo (parcela menor, paga sempre).',
    },
    {
        id: 'fem-vit-15',
        name: 'Horizonte Feminino Vitalício (Pago em 15 anos)',
        type: 'VIT',
        gender: 'feminino',
        coverageVitalicia: 1_000_000,
        coverageTemporaria: 0,
        totalCoverage: 1_000_000,
        monthlyPayment: 2329.68,
        annualPayment: 26837.88,
        paymentPeriodVit: '15 Anos',
        tempCoverageYears: 0,
        paymentYearsVit: 15,
        description: 'Cobertura vitalícia de R$ 1 milhão, quitada em 15 anos (parcela maior, mas para de pagar).',
    },
    {
        id: 'fem-vit-temp-10',
        name: 'Horizonte Feminino VIT + Temporária 10 anos',
        type: 'VIT_TEMP',
        gender: 'feminino',
        coverageVitalicia: 500_000,
        coverageTemporaria: 500_000,
        totalCoverage: 1_000_000,
        monthlyPayment: 593.44,
        annualPayment: 6836.39,
        paymentPeriodVit: 'Vitalício',
        tempCoverageYears: 10,
        paymentYearsVit: 0,
        description: 'R$ 500 mil vitalício + R$ 500 mil temporário (10 anos). Menor parcela, ideal para quem quer proteção extra nos primeiros anos.',
    },
    {
        id: 'fem-vit-temp-20',
        name: 'Horizonte Feminino VIT + Temporária 20 anos',
        type: 'VIT_TEMP',
        gender: 'feminino',
        coverageVitalicia: 500_000,
        coverageTemporaria: 500_000,
        totalCoverage: 1_000_000,
        monthlyPayment: 629.69,
        annualPayment: 7253.98,
        paymentPeriodVit: 'Vitalício',
        tempCoverageYears: 20,
        paymentYearsVit: 0,
        description: 'R$ 500 mil vitalício + R$ 500 mil temporário (20 anos). Proteção extra por mais tempo com parcela acessível.',
    },
    {
        id: 'fem-vit-temp-30',
        name: 'Horizonte Feminino VIT + Temporária 30 anos',
        type: 'VIT_TEMP',
        gender: 'feminino',
        coverageVitalicia: 500_000,
        coverageTemporaria: 500_000,
        totalCoverage: 1_000_000,
        monthlyPayment: 680.65,
        annualPayment: 7841.08,
        paymentPeriodVit: 'Vitalício',
        tempCoverageYears: 30,
        paymentYearsVit: 0,
        description: 'R$ 500 mil vitalício + R$ 500 mil temporário (30 anos). Máxima proteção extra com parcela equilibrada.',
    },
];

// ========================================
// PLANOS MASCULINOS (9)
// ========================================

const masculinePlans: InsurancePlan[] = [
    {
        id: 'masc-vit',
        name: 'Horizonte Masculino Vitalício',
        type: 'VIT',
        gender: 'masculino',
        coverageVitalicia: 1_000_000,
        coverageTemporaria: 0,
        totalCoverage: 1_000_000,
        monthlyPayment: 1276.25,
        annualPayment: 14702.41,
        paymentPeriodVit: 'Vitalício',
        tempCoverageYears: 0,
        paymentYearsVit: 0,
        description: 'Cobertura vitalícia de R$ 1 milhão com pagamento contínuo (parcela menor, paga sempre).',
    },
    {
        id: 'masc-vit-15',
        name: 'Horizonte Masculino Vitalício (Pago em 15 anos)',
        type: 'VIT',
        gender: 'masculino',
        coverageVitalicia: 1_000_000,
        coverageTemporaria: 0,
        totalCoverage: 1_000_000,
        monthlyPayment: 2635.70,
        annualPayment: 30363.29,
        paymentPeriodVit: '15 Anos',
        tempCoverageYears: 0,
        paymentYearsVit: 15,
        description: 'Cobertura vitalícia de R$ 1 milhão, quitada em 15 anos (parcela maior, mas para de pagar).',
    },
    {
        id: 'masc-vit-30',
        name: 'Horizonte Masculino Vitalício (Pago em 30 anos)',
        type: 'VIT',
        gender: 'masculino',
        coverageVitalicia: 1_000_000,
        coverageTemporaria: 0,
        totalCoverage: 1_000_000,
        monthlyPayment: 1567.65,
        annualPayment: 18046.63,
        paymentPeriodVit: '30 Anos',
        tempCoverageYears: 0,
        paymentYearsVit: 30,
        description: 'Cobertura vitalícia de R$ 1 milhão, quitada em 30 anos (equilíbrio entre parcela e prazo).',
    },
    {
        id: 'masc-vit-temp-10',
        name: 'Horizonte Masculino VIT + Temporária 10 anos',
        type: 'VIT_TEMP',
        gender: 'masculino',
        coverageVitalicia: 500_000,
        coverageTemporaria: 500_000,
        totalCoverage: 1_000_000,
        monthlyPayment: 714.07,
        annualPayment: 8226.06,
        paymentPeriodVit: 'Vitalício',
        tempCoverageYears: 10,
        paymentYearsVit: 0,
        description: 'R$ 500 mil vitalício + R$ 500 mil temporário (10 anos). Menor parcela, proteção extra nos primeiros anos.',
    },
    {
        id: 'masc-vit-temp-20',
        name: 'Horizonte Masculino VIT + Temporária 20 anos',
        type: 'VIT_TEMP',
        gender: 'masculino',
        coverageVitalicia: 500_000,
        coverageTemporaria: 500_000,
        totalCoverage: 1_000_000,
        monthlyPayment: 767.74,
        annualPayment: 8844.28,
        paymentPeriodVit: 'Vitalício',
        tempCoverageYears: 20,
        paymentYearsVit: 0,
        description: 'R$ 500 mil vitalício + R$ 500 mil temporário (20 anos). Proteção extra por mais tempo.',
    },
    {
        id: 'masc-vit-temp-30',
        name: 'Horizonte Masculino VIT + Temporária 30 anos',
        type: 'VIT_TEMP',
        gender: 'masculino',
        coverageVitalicia: 500_000,
        coverageTemporaria: 500_000,
        totalCoverage: 1_000_000,
        monthlyPayment: 849.10,
        annualPayment: 9781.55,
        paymentPeriodVit: 'Vitalício',
        tempCoverageYears: 30,
        paymentYearsVit: 0,
        description: 'R$ 500 mil vitalício + R$ 500 mil temporário (30 anos). Máxima proteção extra.',
    },
    {
        id: 'masc-vit15-temp-15',
        name: 'Horizonte Masculino VIT 15 + Temporária 15 anos',
        type: 'VIT_TEMP',
        gender: 'masculino',
        coverageVitalicia: 500_000,
        coverageTemporaria: 500_000,
        totalCoverage: 1_000_000,
        monthlyPayment: 1408.62,
        annualPayment: 16227.87,
        paymentPeriodVit: '15 Anos',
        tempCoverageYears: 15,
        paymentYearsVit: 15,
        description: 'R$ 500 mil vitalício (pago em 15 anos) + R$ 500 mil temporário (15 anos). Quita tudo em 15 anos.',
    },
    {
        id: 'masc-vit20-temp-20',
        name: 'Horizonte Masculino VIT 20 + Temporária 20 anos',
        type: 'VIT_TEMP',
        gender: 'masculino',
        coverageVitalicia: 500_000,
        coverageTemporaria: 500_000,
        totalCoverage: 1_000_000,
        monthlyPayment: 1143.34,
        annualPayment: 13171.26,
        paymentPeriodVit: '20 Anos',
        tempCoverageYears: 20,
        paymentYearsVit: 20,
        description: 'R$ 500 mil vitalício (pago em 20 anos) + R$ 500 mil temporário (20 anos). Equilíbrio perfeito.',
    },
    {
        id: 'masc-vit30-temp-30',
        name: 'Horizonte Masculino VIT 30 + Temporária 30 anos',
        type: 'VIT_TEMP',
        gender: 'masculino',
        coverageVitalicia: 500_000,
        coverageTemporaria: 500_000,
        totalCoverage: 1_000_000,
        monthlyPayment: 994.79,
        annualPayment: 11453.66,
        paymentPeriodVit: '30 Anos',
        tempCoverageYears: 30,
        paymentYearsVit: 30,
        description: 'R$ 500 mil vitalício (pago em 30 anos) + R$ 500 mil temporário (30 anos). Menor parcela com quitação.',
    },
];

// ========================================
// TABELA DE FATORES DE AJUSTE POR IDADE
// Referência: tábua atuarial BR-EMS (SUSEP)
// Base: idade 37 = fator 1.00
// ========================================

export interface AgeFactor {
    minAge: number;
    maxAge: number;
    factor: number;
    label: string;
}

// Fatores para planos com Prazo de Pagamento Fixo (15, 20, 30 anos)
// Curva mais achatada, testada com dados reais do portal (06/03/2026)
export const AGE_FACTORS_PRAZO_FIXO: AgeFactor[] = [
    { minAge: 18, maxAge: 25, factor: 0.65, label: 'Jovem (risco muito baixo)' },
    { minAge: 26, maxAge: 30, factor: 0.81, label: 'Adulto jovem (risco baixo)' },
    { minAge: 31, maxAge: 35, factor: 0.92, label: 'Adulto (próximo da base)' },
    { minAge: 36, maxAge: 40, factor: 1.00, label: 'Faixa base (referência 37)' },
    { minAge: 41, maxAge: 45, factor: 1.17, label: 'Meia-idade (aumento mod)' },
    { minAge: 46, maxAge: 50, factor: 1.38, label: 'Meia-idade av (aumento mod)' },
    { minAge: 51, maxAge: 55, factor: 1.65, label: 'Sênior (risco elevado)' },
    { minAge: 56, maxAge: 60, factor: 2.10, label: 'Sênior avançado (risco alto)' },
    { minAge: 61, maxAge: 65, factor: 2.70, label: 'Terceira idade (muito alto)' },
];

// Fatores para planos com Pagamento Contínuo/Vitalício
// Curva altamente inclinada (exponencial), validada contra o portal (06/03/2026)
export const AGE_FACTORS_VITALICIO: AgeFactor[] = [
    { minAge: 18, maxAge: 25, factor: 0.65, label: 'Jovem (risco muito baixo)' },
    { minAge: 26, maxAge: 30, factor: 0.78, label: 'Adulto jovem (risco baixo)' },
    { minAge: 31, maxAge: 35, factor: 0.95, label: 'Adulto (próximo da base)' },
    { minAge: 36, maxAge: 40, factor: 1.00, label: 'Faixa base (referência 37)' },
    { minAge: 41, maxAge: 45, factor: 1.62, label: 'Meia-idade (aumento alto)' },
    { minAge: 46, maxAge: 50, factor: 2.10, label: 'Meia-idade avançada (alto)' },
    { minAge: 51, maxAge: 55, factor: 2.64, label: 'Sênior (risco muito alto)' },
    { minAge: 56, maxAge: 60, factor: 3.20, label: 'Sênior avançado (crítico)' },
    { minAge: 61, maxAge: 65, factor: 4.00, label: 'Terceira idade (limite)' },
];

// ========================================
// FUNÇÕES UTILITÁRIAS
// ========================================

/** Todos os 14 planos */
export const ALL_PLANS: InsurancePlan[] = [...femininePlans, ...masculinePlans];

/** Busca planos por gênero */
export function getPlansByGender(gender: Gender): InsurancePlan[] {
    return ALL_PLANS.filter(p => p.gender === gender);
}

/** 
 * Busca fator de ajuste com base na idade E no tipo de pagamento do plano.
 * Planos quitáveis (15, 20, 30 anos) usam curva diferente dos Vitalícios.
 */
export function getAgeFactor(age: number, isVitalicio: boolean): number {
    const table = isVitalicio ? AGE_FACTORS_VITALICIO : AGE_FACTORS_PRAZO_FIXO;
    const match = table.find(f => age >= f.minAge && age <= f.maxAge);
    return match?.factor ?? 1.0;
}

/** Calcula o pagamento mensal estimado para uma idade específica num plano */
export function estimateMonthlyPayment(plan: InsurancePlan, age: number): number {
    const isVitalicio = plan.paymentPeriodVit === 'Vitalício';
    const factor = getAgeFactor(age, isVitalicio);
    return Math.round(plan.monthlyPayment * factor * 100) / 100;
}

/** Calcula o pagamento anual estimado para uma idade específica num plano */
export function estimateAnnualPayment(plan: InsurancePlan, age: number): number {
    const isVitalicio = plan.paymentPeriodVit === 'Vitalício';
    const factor = getAgeFactor(age, isVitalicio);
    return Math.round(plan.annualPayment * factor * 100) / 100;
}

/**
 * Gera texto formatado com os planos recomendados para o agente.
 * Filtra por gênero e ordena por preço mensal estimado.
 */
export function getFormattedPlansForAgent(gender: Gender, age: number): string {
    const plans = getPlansByGender(gender);

    const lines = plans
        .sort((a, b) => a.monthlyPayment - b.monthlyPayment)
        .map((p, i) => {
            const estMonthly = estimateMonthlyPayment(p, age);
            const estAnnual = estimateAnnualPayment(p, age);
            return [
                `${i + 1}. ${p.name}`,
                `   Tipo: ${p.type === 'VIT' ? 'Somente Vitalício' : 'Vitalício + Temporária'}`,
                `   Indenização Total: R$ ${p.totalCoverage.toLocaleString('pt-BR')}`,
                p.type === 'VIT_TEMP'
                    ? `   (R$ ${p.coverageVitalicia.toLocaleString('pt-BR')} vitalício + R$ ${p.coverageTemporaria.toLocaleString('pt-BR')} temporário por ${p.tempCoverageYears} anos)`
                    : '',
                `   Pagamento Mensal Estimado: ~R$ ${estMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `   Pagamento Anual Estimado: ~R$ ${estAnnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `   Prazo de Pagamento: ${p.paymentPeriodVit}`,
                `   ${p.description}`,
            ].filter(Boolean).join('\n');
        });

    return [
        `PLANOS DISPONÍVEIS PARA ${gender.toUpperCase()} (Estimativa para ${age} anos):`,
        `⚠️ Valores são estimativas baseadas na idade. A cotação oficial será feita pelo Douglas na reunião.`,
        '',
        ...lines,
    ].join('\n');
}

// ========================================
// BENEFÍCIOS INCLUSOS EM TODOS OS PLANOS
// ========================================

export const INCLUDED_BENEFITS = [
    'Adiantamento por Doença Terminal (recebe a indenização em vida se diagnosticado)',
    'Assistência Domiciliar (encanador, eletricista, chaveiro, vigilante, mudança)',
    'Seguro Viagem (despesas médicas no exterior, traslado, bagagem, documentos)',
    'Resgate a partir do 25º mês (25% → 100% no 10º ano)',
    'Saldamento (parar de pagar e manter cobertura reduzida proporcional)',
    'Parcelas NÃO aumentam com a idade (correção apenas pelo IPCA)',
    'Atualização anual apenas pelo IPCA',
];

// ========================================
// PROMPT DO AGENTE (para uso no system prompt da persona)
// ========================================

const REPRESENTATIVE_AGES = [20, 25, 30, 35, 37, 40, 45, 50, 55, 60, 65];

function formatBRL(val: number): string {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateProjectionTablesForPrompt(femPlans: InsurancePlan[], mascPlans: InsurancePlan[]): string {
    const lines: string[] = [];
    lines.push('=== TABELA DE VALORES POR IDADE (Estimativas) ===');
    lines.push('⚠️ Valores são estimativas baseadas em fatores atuariais. A cotação oficial é feita pelo Douglas na reunião.');
    lines.push('');

    lines.push('FEMININOS:');
    for (const plan of femPlans) {
        lines.push(`▸ ${plan.name}`);
        for (const age of REPRESENTATIVE_AGES) {
            const monthly = estimateMonthlyPayment(plan, age);
            lines.push(`  ${age} anos: ~R$ ${formatBRL(monthly)}/mês`);
        }
        lines.push('');
    }

    lines.push('MASCULINOS:');
    for (const plan of mascPlans) {
        lines.push(`▸ ${plan.name}`);
        for (const age of REPRESENTATIVE_AGES) {
            const monthly = estimateMonthlyPayment(plan, age);
            lines.push(`  ${age} anos: ~R$ ${formatBRL(monthly)}/mês`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

export function buildInsuranceAgentPrompt(): string {
    return `
IDENTIDADE E PAPEL:
Você é um(a) consultor(a) de seguros especializado(a) no Seguro de Vida Horizonte da Icatu Seguros.
Você trabalha junto com o corretor Douglas Resende Teixeira da Silva.
Seu papel é orientar o lead sobre as melhores opções de seguro de vida com base no perfil dele(a).
Seja consultivo, empático e profissional. Use linguagem acessível, evite jargões técnicos.

SOBRE O PRODUTO HORIZONTE:
O Horizonte é um seguro de vida diferenciado que combina proteção com formação de reserva resgatável.
- As parcelas NÃO aumentam com a idade (correção apenas pelo IPCA)
- É possível quitar o seguro e continuar protegido (opções de 15, 20, 25, 30 anos ou vitalício)
- Resgate disponível a partir do 25º mês (começa em 25%, chega a 100% no 10º ano)
- Saldamento: se parar de pagar, pode manter cobertura reduzida proporcional
- Seguradora: Icatu Seguros (fundada em 1991, +6 milhões de clientes, SUSEP nº 15414.611834/2025-17)

TIPOS DE PLANO:
1. SOMENTE VITALÍCIO (VIT): Cobertura de R$ 1.000.000 com indenização vitalícia
2. VITALÍCIO + TEMPORÁRIO (VIT+TEMP): R$ 500 mil vitalício + R$ 500 mil temporário (10, 15, 20 ou 30 anos)
   - O VIT+TEMP dá indenização DOBRADA durante o período temporário (proteção extra enquanto filhos são pequenos ou tem dívida grande)

BENEFÍCIOS INCLUSOS EM TODOS OS PLANOS:
${INCLUDED_BENEFITS.map(b => `• ${b}`).join('\n')}

${generateProjectionTablesForPrompt(femininePlans, masculinePlans)}


FLUXO DE ATENDIMENTO:
1. Cumprimentar o lead pelo nome (se disponível nos dados do formulário)
2. Usar os dados JÁ recebidos do formulário (data de nascimento → calcular idade, profissão, renda, objetivo, condições de saúde)
3. Se faltar o sexo/gênero, perguntar naturalmente: "Para trazer as melhores opções, preciso saber: o seguro seria para homem ou mulher?"
4. Apresentar 2-3 opções mais adequadas ao perfil, COM valores estimados para a idade do lead
5. Sempre deixar claro: "Esses valores são estimativas personalizadas. Na reunião com o Douglas, ele faz a cotação oficial exata."
6. Responder dúvidas sobre coberturas, resgate, saldamento, benefícios
7. Se o lead demonstrar MUITA DÚVIDA ou pedir para falar com alguém → oferecer agendar reunião com o Douglas
8. Se o lead estiver decidido → agendar reunião com o Douglas para formalizar

CRITÉRIOS DE RECOMENDAÇÃO (TIPO DE PLANO):
- Orçamento apertado + quer proteção máxima → VIT+TEMP (parcela menor, indenização dobrada por um tempo)
- Orçamento confortável + quer simplicidade → Somente VIT (parcela maior, mas cobertura única de R$ 1 milhão para sempre)
- Quer parar de pagar um dia → Planos com prazo de pagamento (15, 20 ou 30 anos)
- Tem filhos pequenos ou dívida grande → VIT+TEMP com temporária de 20-30 anos
- Jovem (< 30 anos) → Parcelas bem menores, destacar o benefício de começar cedo
- Condição de saúde (doença/cirurgia) → Informar que a aceitação está sujeita a análise de risco, mas que isso não impede análise

FILTRO DE ORÇAMENTO E CAPITAL SEGURADO (MUITO IMPORTANTE):
Preste extrema atenção na faixa de investimento que o lead preencheu no formulário (ex: "de R$100 a R$175/mês", "de R$401 a R$600", etc.).
Lembre-se que as tabelas de referência acima são para uma **cobertura Premium de R$ 1.000.000,00**.
- SE o orçamento do lead for MENOR que o valor estimado para a idade dele na tabela de 1 Milhão (ex: ele quer pagar até R$ 175, mas para a idade dele o plano mais barato é R$ 300), NÃO perca a venda e NÃO diga que não temos planos.
- COMO AGIR NESSE CASO: Recomende o plano mais barato disponível para a idade dele (mostre o valor base dele da tabela), mas diga de forma empática: "Notei que você selecionou a faixa de [inserir faixa escolhida]. O valor que eu mostrei é para uma cobertura robusta de R$ 1 Milhão. Fique tranquilo(a)! Na sua reunião, o Douglas consegue flexibilizar o capital segurado (por exemplo, ajustar a proteção para R$ 500 mil ou R$ 350 mil) para encaixar exatamente no valor mensal que fica confortável para você!"

REGRAS IMPORTANTES:
- NUNCA invente valores exatos fora da tabela. Use a tabela + faixas para estimar e diga "estimativa"
- NUNCA prometa aprovação do seguro (depende de análise de risco da Icatu)
- Se o lead perguntar algo complexo → "Essa é uma ótima pergunta! O Douglas te dará essa informação com detalhes na reunião."
- Use emojis com moderação (1-2 por mensagem no máximo)
- Seja direto e claro

ESCALONAMENTO PARA REUNIÃO:
Quando identificar que é hora de agendar com o Douglas, use a ferramenta schedule_meeting.
Motivos para escalar:
- Lead pede para adaptar o capital (ex: R$ 500 mil) para caber no bolso
- Lead quer cotação oficial/exata (para 1 milhão ou outros valores)
- Lead está decidido, tem muitas dúvidas ou pergunta sobre saúde
`.trim();
}
