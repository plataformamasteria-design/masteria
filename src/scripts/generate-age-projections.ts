import { ALL_PLANS, AGE_FACTORS_VITALICIO, AGE_FACTORS_PRAZO_FIXO, estimateMonthlyPayment, estimateAnnualPayment, type InsurancePlan } from '@/data/insurance-plans';
import * as fs from 'fs';

// Idades representativas para as tabelas
const REPRESENTATIVE_AGES = [20, 25, 30, 35, 37, 40, 45, 50, 55, 60, 65];

function formatBRL(val: number): string {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateProjectionTable(plan: InsurancePlan): string {
    const lines: string[] = [];
    lines.push(`### ${plan.name}`);
    lines.push(`- **Tipo:** ${plan.type === 'VIT' ? 'Somente Vitalício' : 'Vitalício + Temporária'}`);
    lines.push(`- **Indenização Total:** R$ ${plan.totalCoverage.toLocaleString('pt-BR')}`);
    if (plan.type === 'VIT_TEMP') {
        lines.push(`- **Vitalícia:** R$ ${plan.coverageVitalicia.toLocaleString('pt-BR')} | **Temporária (${plan.tempCoverageYears} anos):** R$ ${plan.coverageTemporaria.toLocaleString('pt-BR')}`);
    }
    lines.push(`- **Prazo de Pagamento:** ${plan.paymentPeriodVit}`);
    lines.push('');
    lines.push('| Idade | Mensal (R$) | Anual (R$) | Observação |');
    lines.push('|------:|------------:|-----------:|------------|');

    for (const age of REPRESENTATIVE_AGES) {
        const monthly = estimateMonthlyPayment(plan, age);
        const annual = estimateAnnualPayment(plan, age);
        const note = age === 37 ? '← VALOR BASE (PDF)' : '';
        lines.push(`| ${age} | ${formatBRL(monthly)} | ${formatBRL(annual)} | ${note} |`);
    }

    lines.push('');
    return lines.join('\n');
}

function generateAgentPromptTable(plan: InsurancePlan): string {
    const lines: string[] = [];
    const label = plan.type === 'VIT_TEMP'
        ? `${plan.name} (${plan.paymentPeriodVit})`
        : `${plan.name} (${plan.paymentPeriodVit})`;

    lines.push(`▸ ${plan.name}`);

    for (const age of REPRESENTATIVE_AGES) {
        const monthly = estimateMonthlyPayment(plan, age);
        lines.push(`  ${age} anos: ~R$ ${formatBRL(monthly)}/mês`);
    }

    return lines.join('\n');
}

// ==========================================
// 1. Gerar documento de referência completo
// ==========================================
const mdLines: string[] = [];
mdLines.push('# Projeções de Valores — Seguro de Vida Horizonte (Icatu)');
mdLines.push('');
mdLines.push('> Valores estimados com base nos PDFs originais (idade 37) e fatores de ajuste atuariais (BR-EMS).');
mdLines.push('> **Os valores são estimativas. A cotação oficial é feita pelo corretor Douglas.**');
mdLines.push('');
mdLines.push('---');
mdLines.push('');

// Fatores de referência
mdLines.push('## Fatores de Ajuste por Idade');
mdLines.push('');
mdLines.push('### 1. Curva para Pagamento Vitalício');
mdLines.push('| Faixa | Fator | Descrição |');
mdLines.push('|------:|------:|-----------|');
for (const f of AGE_FACTORS_VITALICIO) {
    mdLines.push(`| ${f.minAge}-${f.maxAge} | ${f.factor.toFixed(2)}x | ${f.label} |`);
}
mdLines.push('');
mdLines.push('### 2. Curva para Prazo Fixo (15, 20, 30 anos)');
mdLines.push('| Faixa | Fator | Descrição |');
mdLines.push('|------:|------:|-----------|');
for (const f of AGE_FACTORS_PRAZO_FIXO) {
    mdLines.push(`| ${f.minAge}-${f.maxAge} | ${f.factor.toFixed(2)}x | ${f.label} |`);
}
mdLines.push('');
mdLines.push('---');
mdLines.push('');

// Planos Femininos
mdLines.push('## Planos Femininos');
mdLines.push('');
const femPlans = ALL_PLANS.filter(p => p.gender === 'feminino');
for (const plan of femPlans) {
    mdLines.push(generateProjectionTable(plan));
    mdLines.push('---');
    mdLines.push('');
}

// Planos Masculinos
mdLines.push('## Planos Masculinos');
mdLines.push('');
const mascPlans = ALL_PLANS.filter(p => p.gender === 'masculino');
for (const plan of mascPlans) {
    mdLines.push(generateProjectionTable(plan));
    mdLines.push('---');
    mdLines.push('');
}

const mdContent = mdLines.join('\n');
fs.writeFileSync('E:/Projetos-Antigrav/masteria-x-oficial/docs/propostas-ativas/projecoes-por-idade.md', mdContent, 'utf-8');
console.log(`✅ Documento de referência salvo: docs/propostas-ativas/projecoes-por-idade.md (${mdContent.length} chars)`);

// ==========================================
// 2. Gerar tabela compacta para o prompt
// ==========================================
const promptLines: string[] = [];
promptLines.push('=== TABELA DE VALORES POR IDADE (Estimativas) ===');
promptLines.push('⚠️ Valores são estimativas baseadas em fatores atuariais. A cotação oficial é feita pelo Douglas na reunião.');
promptLines.push('');

promptLines.push('FEMININOS:');
for (const plan of femPlans) {
    promptLines.push(generateAgentPromptTable(plan));
    promptLines.push('');
}

promptLines.push('MASCULINOS:');
for (const plan of mascPlans) {
    promptLines.push(generateAgentPromptTable(plan));
    promptLines.push('');
}

const promptContent = promptLines.join('\n');
fs.writeFileSync('/tmp/projecoes-prompt-section.txt', promptContent, 'utf-8');
console.log(`✅ Seção do prompt salva: /tmp/projecoes-prompt-section.txt (${promptContent.length} chars, ~${Math.round(promptContent.length / 4)} tokens)`);

// ==========================================
// 3. Validação
// ==========================================
console.log('\n=== VALIDAÇÃO ===');

// Verificar que 37 anos = valor base exato
for (const plan of ALL_PLANS) {
    const est = estimateMonthlyPayment(plan, 37);
    if (est !== plan.monthlyPayment) {
        throw new Error(`❌ ${plan.id}: Esperado R$ ${plan.monthlyPayment} para 37 anos, obteve R$ ${est}`);
    }
}
console.log('✅ Todos os valores base (37 anos) conferem com os PDFs originais');

// Verificar crescimento monotônico
for (const plan of ALL_PLANS) {
    let prev = 0;
    for (const age of REPRESENTATIVE_AGES) {
        const est = estimateMonthlyPayment(plan, age);
        if (est < prev) {
            throw new Error(`❌ ${plan.id}: Valor diminuiu de R$ ${prev} (anterior) para R$ ${est} (${age} anos)`);
        }
        prev = est;
    }
}
console.log('✅ Todos os valores crescem monotonicamente com a idade');

// Amostra de valores
console.log('\n--- Amostra: Masculino VIT ---');
const mascVit = ALL_PLANS.find(p => p.id === 'masc-vit')!;
for (const age of REPRESENTATIVE_AGES) {
    console.log(`  ${age} anos: R$ ${formatBRL(estimateMonthlyPayment(mascVit, age))}/mês`);
}

console.log('\n🎉 TODAS AS PROJEÇÕES GERADAS E VALIDADAS COM SUCESSO!');
