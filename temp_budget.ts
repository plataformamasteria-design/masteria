import { ALL_PLANS, AGE_FACTORS_VITALICIO, AGE_FACTORS_PRAZO_FIXO, estimateMonthlyPayment } from './src/data/insurance-plans';

const ranges = [
    { label: 'de R$100 a R$175/mês', min: 100, max: 175 },
    { label: 'de R$176 a R$400/mês', min: 176, max: 400 },
    { label: 'de R$401 a R$600/mês', min: 401, max: 600 },
    { label: 'de R$601 a R$1000/mês', min: 601, max: 1000 },
    { label: 'Acima de R$1000/mês', min: 1001, max: 999999 }
];

const testAges = [25, 37, 50];

console.log('Análise de Opções de Planos por Faixa de Orçamento\n');

for (const age of testAges) {
    console.log(`\n=== IDADE: ${age} ANOS ===`);

    for (const range of ranges) {
        console.log(`\nFaixa: ${range.label}`);

        const femOptions = ALL_PLANS.filter(p => p.gender === 'feminino' && estimateMonthlyPayment(p, age) >= range.min && estimateMonthlyPayment(p, age) <= range.max);
        const mascOptions = ALL_PLANS.filter(p => p.gender === 'masculino' && estimateMonthlyPayment(p, age) >= range.min && estimateMonthlyPayment(p, age) <= range.max);

        if (femOptions.length === 0 && mascOptions.length === 0) {
            console.log('  ⚠️ NENHUMA OPÇÃO NESSA FAIXA');
        } else {
            femOptions.forEach(p => console.log(`  [F] ${p.name} -> R$ ${estimateMonthlyPayment(p, age).toFixed(2)}`));
            mascOptions.forEach(p => console.log(`  [M] ${p.name} -> R$ ${estimateMonthlyPayment(p, age).toFixed(2)}`));
        }
    }
}
