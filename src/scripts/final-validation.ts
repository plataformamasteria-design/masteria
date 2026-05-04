import { config } from 'dotenv';

config();

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const AGENT_ID = 'agent_fcfcf7f9c84e377b0a1711c0bb';
const _TARGET_NUMBER = '+553322980007';

async function finalValidation() {
  if (!RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not configured');
    process.exit(1);
  }

  console.log('\n🔍 VALIDAÇÃO FINAL DO SISTEMA VOICE AI\n');
  console.log('='.repeat(50));
  console.log('');

  let allPassed = true;

  try {
    // Check 1: Get agent status
    console.log('📋 Check 1: Status do Agente...\n');
    
    const agentResp = await fetch(`https://api.retellai.com/get-agent/${AGENT_ID}`, {
      headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` },
    });
    const agent = await agentResp.json();
    
    const isPublished = agent.is_published;
    console.log(`   Agent Name: ${agent.agent_name}`);
    console.log(`   Version: ${agent.version}`);
    console.log(`   Published: ${isPublished ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   LLM ID: ${agent.response_engine?.llm_id || 'N/A'}`);
    console.log(`   Webhook: ${agent.webhook_url ? '✅ Configurado' : '❌ Não configurado'}`);
    console.log('');

    if (!isPublished) {
      console.log('   ⚠️  AGENTE NÃO PUBLICADO - Publicar no Dashboard Retell');
      allPassed = false;
    }

    // Check 2: Phone number assignment
    console.log('📱 Check 2: Configuração do Número...\n');
    
    const numbersResp = await fetch('https://api.retellai.com/list-phone-numbers', {
      headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` },
    });
    const numbers = await numbersResp.json();
    const targetNum = numbers.find((n: any) => n.phone_number?.includes('33229800'));

    if (targetNum) {
      console.log(`   Número: ${targetNum.phone_number}`);
      console.log(`   Inbound Agent: ${targetNum.inbound_agent_id === AGENT_ID ? '✅ Correto' : '❌ Incorreto'}`);
      console.log(`   Outbound Agent: ${targetNum.outbound_agent_id === AGENT_ID ? '✅ Correto' : '❌ Incorreto'}`);
      console.log(`   Inbound Version: ${targetNum.inbound_agent_version}`);
      console.log(`   Outbound Version: ${targetNum.outbound_agent_version}`);
      console.log('');

      if (targetNum.inbound_agent_id !== AGENT_ID) {
        console.log('   ⚠️  Inbound agent incorreto');
        allPassed = false;
      }
    } else {
      console.log('   ❌ Número não encontrado no Retell');
      allPassed = false;
    }

    // Check 3: Webhook connectivity
    console.log('🌐 Check 3: Conectividade do Webhook...\n');
    
    const webhookUrl = agent.webhook_url;
    if (webhookUrl) {
      console.log(`   URL: ${webhookUrl}`);
      console.log(`   Status: ✅ Configurado`);
    } else {
      console.log('   ❌ Webhook não configurado');
      allPassed = false;
    }
    console.log('');

    // Summary
    console.log('='.repeat(50));
    console.log('');

    if (allPassed) {
      console.log('🎉 SISTEMA PRONTO PARA CHAMADAS!\n');
      console.log('📞 Faça uma ligação de teste:');
      console.log('   Disque: +55 33 2298-0007');
      console.log('   De: +55 64 99952-6870');
      console.log('');
      console.log('   O agente deve atender e falar!');
    } else {
      console.log('❌ SISTEMA NÃO ESTÁ PRONTO\n');
      console.log('Ações necessárias:');
      
      if (!isPublished) {
        console.log('   1. Publicar agente no Dashboard Retell:');
        console.log('      - URL: https://dashboard.retell.ai');
        console.log('      - Agente: assistente-2');
        console.log('      - Clique "Publish" → selecione números → Publish');
      }
    }

    console.log('');

  } catch (error: any) {
    console.error('❌ Erro na validação:', error.message);
    process.exit(1);
  }
}

finalValidation().catch(console.error);
