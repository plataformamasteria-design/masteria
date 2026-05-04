#!/usr/bin/env node

const crypto = require('crypto');
const path = require('path');

// Dados dos 38 usuários
const users = [
  { id: "a14d3736-737c-4b74-918b-2bb1bfedf2d8", name: "Fabiana Consoni", email: "ecoorsolar@gmail.com" },
  { id: "be8752c1-71c9-4706-a03b-6000dc8b2f85", name: "Gilberto Bogado", email: "gilbertobogado1@gmail.com" },
  { id: "0302b0c4-aaec-41a4-a2c6-cd9cd890739b", name: "Gabriel Pantoni Rosa", email: "pisalyanalises@gmail.com" },
  { id: "3346205a-e030-4d17-b007-a27ac6d87a97", name: "ANTONIO PRIETO NETO", email: "iacademiadamente@gmail.com" },
  { id: "1b9fca93-3f17-4e0d-a0df-484f8d901f22", name: "Maria Silva QA Forense", email: "maria.silva.qa.forense@masterai.com" },
  { id: "27e109ec-6a31-48a3-ae5b-2146c5fc0ef2", name: "Usuário Teste Forense", email: "teste@exemplo.com" },
  { id: "59c1e420-9016-439e-9d05-04f1b579257c", name: "Jeferson Teste", email: "jeferson@masterxoficial.com.br" },
  { id: "51830c54-faf3-4469-8dab-2b87140f976d", name: "com", email: "com@master.com.br" },
  { id: "07df58f7-5adf-4c22-b012-77ee0642473f", name: "Teste Automático", email: "teste.auto@test.com" },
  { id: "7c65c291-3fb1-4ab5-b29f-f7dcdb52164c", name: "User Test", email: "usertest@example.com" },
  { id: "5327bde2-6bd0-4891-a8a5-248e3325ab38", name: "Teste Automatizado", email: "teste@automated.com" },
  { id: "78fd4ea3-7bba-482a-833e-6474cfb0559c", name: "Test User", email: "test@example.com" },
  { id: "1a16af46-22a6-4434-99fd-2a91c51171db", name: "Teste Admin", email: "teste@admin.com" },
  { id: "8a202752-867c-4968-b5f8-134de6dbb2a2", name: "João Silva QA Tester", email: "joao.silva.qa@masterai.com" },
  { id: "a2a88a59-673c-4c13-be13-1ff831eb5c5b", name: "Test User", email: "test@masteria.com" },
  { id: "65f27a66-be20-451e-903a-8b9864944792", name: "WAHA Test", email: "waha-test-1759708836@example.com" },
  { id: "3290287f-3c7a-43a6-aed7-217e4985b0fd", name: "AutoTest User", email: "test_autotest@masterIA.com" },
  { id: "eac45578-a9bf-40cd-a65f-26f040e8b77d", name: "Teste E2E Meeting BaaS", email: "teste.e2e@meetingbaas.com" },
  { id: "c0a8caf8-8d95-42ed-90a1-59279a214450", name: "admin", email: "admin@ag12x.com.br" },
  { id: "76e014b2-b8b3-47f9-92de-1fcbdb3465dd", name: "Contato diego", email: "contato@diegoabneroficial.com" },
  { id: "f069dc06-8a54-4640-8c39-ef94e54658cb", name: "Test", email: "test@test.com" },
  { id: "af07b4f3-1488-480e-990d-7ef72129d24a", name: "Usuário E2E Teste", email: "teste.e2e@masteriaoficial.com" },
  { id: "207c3d93-2d5e-4aa8-b67b-25231f71505a", name: "Jeferson Teste", email: "jeferson@masteriaoficial.com.br" },
  { id: "9fb27f15-e2fd-4bd3-b877-f6803acfbf6c", name: "João Silva", email: "joao.silva@teste.com" },
  { id: "64bffbe5-ef41-422c-89b5-b1ac0739eb3b", name: "ANTONIO PRIETO NETO", email: "prietovet@gmail.com" },
  { id: "c81931d0-1abe-4ddb-b2d1-963a3b9fa368", name: "Maxcon", email: "contato@maxconcasaeconstrucao.com.br" },
  { id: "6e90fe79-c13e-45af-ac49-5a4d1fc25f33", name: "Fernando Itano", email: "itano@preditiva.ai" },
  { id: "4342361a-87c3-4989-985f-e03ed359bb5a", name: "Eliezer Pereira", email: "eli_p2@hotmail.com" },
  { id: "543dc9bf-0986-40d7-9ebf-ed6f7ce16330", name: "CELSO YUKIO EIZAK", email: "celso.eizak@gmail.com" },
  { id: "d8a8bcd9-ba2b-44c3-afae-5a24846508e2", name: "Cirismar Coutinho", email: "cirismar@gmail.com" },
  { id: "b2e80fe4-834d-4fe9-965b-a5bd9ca4d2b6", name: "Teste", email: "admin@infra12x.com.br" },
  { id: "e9d294d3-8629-4464-8929-6e5d37da7a97", name: "Heitor Santos de Assis", email: "heitorsantos.98assis@gmail.com" },
  { id: "d2d3c43e-cc98-4ffe-97cc-29faa2a3ae2f", name: "PAULO", email: "euphduarte@gmail.com" },
  { id: "9ce8250f-ba3e-46f4-9c46-e401e754d0b8", name: "Diego Vicente", email: "contato@diegovicente.com.br" },
  { id: "214d751e-f582-4303-aad4-c4ddb822eb8a", name: "Diego", email: "diegomaninhu@gmail.com" },
  { id: "dd6f3ea0-84db-41cf-8605-d9cc3317b01a", name: "LILIAN", email: "igrsysten@gmail.com" },
  { id: "e945cce8-48dc-46b0-9ae4-3b02b38d19fc", name: "PH", email: "multidesk.io@gmail.com" },
  { id: "8dd67f43-1f19-409f-9c46-9ce103115944", name: "Paulo Admin", email: "paulo@exemplo.com" }
];

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
console.log('║                  📧 SISTEMA DE RESET DE SENHA EM MASSA                  ║');
console.log('║                         Master IA Oficial                               ║');
console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

console.log(`📊 TOTAL DE USUÁRIOS: ${users.length}\n`);
console.log('═'.repeat(80));
console.log('\n');

const results = [];
let counter = 1;

users.forEach(user => {
  const token = generateToken();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://62863c59-d08b-44f5-a414-d7529041de1a-00-16zuyl87dp7m9.kirk.replit.dev';
  const resetLink = `${baseUrl}/reset-password?token=${token}`;
  
  console.log(`${String(counter).padStart(2, '0')}. ✅ ${user.name.padEnd(40)}`);
  console.log(`    📧 ${user.email.padEnd(50)}`);
  console.log(`    🔗 ${resetLink.substring(0, 65)}...`);
  console.log('');
  
  results.push({
    index: counter,
    userId: user.id,
    name: user.name,
    email: user.email,
    token: token,
    tokenHash: tokenHash,
    expiresAt: expiresAt.toISOString(),
    resetLink: resetLink,
    status: 'pendente_envio'
  });
  
  counter++;
});

console.log('═'.repeat(80));
console.log('\n📋 RESUMO:\n');
console.log(`   ✅ Total de usuários: ${users.length}`);
console.log(`   📧 Emails a enviar: ${users.length}`);
console.log(`   ⏱️  Validade do token: 24 horas`);
console.log(`   🔐 Segurança: Tokens com SHA-256\n`);

console.log('🚀 PRÓXIMAS ETAPAS:\n');
console.log('   1. Configure ADMIN_RESET_TOKEN no arquivo .env');
console.log('   2. Configure NEXT_PUBLIC_BASE_URL no arquivo .env');
console.log('   3. Execute: npm run db:push (para sincronizar schema)');
console.log('   4. Execute: curl -X POST http://localhost:5000/api/admin/send-password-reset \\');
console.log('              -H "Authorization: Bearer YOUR_ADMIN_RESET_TOKEN"');
console.log('\n   OU acesse a rota via navegador após autenticação.\n');

console.log('═'.repeat(80));
console.log('\n✨ Sistema pronto! Todos os 38 usuários receberão emails de reset.\n\n');

// Salvar results em arquivo JSON para referência
const fs = require('fs');
fs.writeFileSync('reset-tokens.json', JSON.stringify(results, null, 2));
console.log('📁 Tokens salvos em: reset-tokens.json\n');

