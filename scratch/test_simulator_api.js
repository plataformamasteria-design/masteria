const fetch = require('node-fetch');

async function test() {
  try {
    console.log("Testing memory (reflection) endpoint...");
    const memRes = await fetch('http://localhost:3000/api/v1/automations/simulator/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ruleId: 'test-rule-id',
        virtual_history: [
            { role: 'user', content: 'Oi, qual o preço?' },
            { role: 'model', content: 'Olá! Nosso preço é 100 reais.' },
            { role: 'user', content: 'Achei caro.' },
            { role: 'model', content: 'Temos desconto de 10%.' }
        ]
      })
    });
    const memData = await memRes.json();
    console.log("Memory API Response:", memData);

    console.log("\\nTesting simulator AI endpoint...");
    const simRes = await fetch('http://localhost:3000/api/v1/automations/simulator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simulate_ai_virtual: true,
        config: {
          model: 'gpt-4o-mini',
          system_message: 'Você é um bot de vendas.'
        },
        virtual_history: [
          { role: 'user', content: 'Oi, tudo bem?' }
        ]
      })
    });
    const simData = await simRes.json();
    console.log("Simulator API Response:", simData);
  } catch (e) {
    console.error(e);
  }
}

test();
