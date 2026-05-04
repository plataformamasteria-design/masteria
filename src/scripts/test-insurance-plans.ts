import { buildInsuranceAgentPrompt, estimateMonthlyPayment, getPlansByGender, getAgeFactor, ALL_PLANS } from '@/data/insurance-plans';
import * as fs from 'fs';

console.log('=== Validação do Módulo de Planos de Seguro ===\n');

// Test 1: Total de planos
console.log(`✅ Total de planos carregados: ${ALL_PLANS.length} (esperado: 14)`);
if (ALL_PLANS.length !== 14) throw new Error('Esperado 14 planos!');

// Test 2: Planos por gênero
const femPlans = getPlansByGender('feminino');
const mascPlans = getPlansByGender('masculino');
console.log(`✅ Planos femininos: ${femPlans.length} (esperado: 5)`);
console.log(`✅ Planos masculinos: ${mascPlans.length} (esperado: 9)`);
if (femPlans.length !== 5) throw new Error('Esperado 5 planos femininos!');
if (mascPlans.length !== 9) throw new Error('Esperado 9 planos masculinos!');

// Test 3: Fatores de ajuste
const ages = [25, 30, 37, 45, 50, 55, 60];
console.log(`\n--- Fatores de Ajuste por Idade (Vitalício) ---`);
ages.forEach(age => {
    const factor = getAgeFactor(age, true);
    console.log(`  ${age} anos → fator ${factor}x`);
});
if (getAgeFactor(37, true) !== 1.0) throw new Error('Fator base (37) deveria ser 1.0!');

// Test 4: Estimativas de valor
console.log(`\n--- Estimativas Masculino VIT (base R$ 1.276,25) ---`);
const mascVit = mascPlans.find(p => p.id === 'masc-vit')!;
ages.forEach(age => {
    const est = estimateMonthlyPayment(mascVit, age);
    console.log(`  ${age} anos: R$ ${est.toFixed(2)}`);
});

// Validação: 37 anos deveria retornar exatamente o valor base
const base37 = estimateMonthlyPayment(mascVit, 37);
if (base37 !== 1276.25) throw new Error(`Esperado R$ 1276.25 para 37 anos, obteve R$ ${base37}`);
console.log(`✅ Valor base 37 anos correto: R$ ${base37}`);

// Test 5: Gerar prompt e salvar
const prompt = buildInsuranceAgentPrompt();
console.log(`\n✅ Prompt gerado com ${prompt.length} caracteres (~${Math.round(prompt.length / 4)} tokens)`);

// Salvar prompt em arquivo para referência
fs.writeFileSync('/tmp/insurance-agent-prompt.txt', prompt, 'utf-8');
console.log(`✅ Prompt salvo em /tmp/insurance-agent-prompt.txt`);

console.log(`\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!`);
