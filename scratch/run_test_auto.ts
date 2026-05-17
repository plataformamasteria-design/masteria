import fetch from 'node-fetch';

async function run() {
    const res = await fetch('http://localhost:3000/api/v1/automations/simulator/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ruleId: '8a11daba-6795-43f5-8c72-cdb59ec6f11e',
            nodeId: 'ai_agent_1778963902000',
            manualUpdate: false,
            is_sandbox: true,
            existing_notes: '',
            system_message: 'Você é um vendedor tentando vender um carro\n',
            reflection_prompt: 'PROMPT TEST',
            virtual_history: [
                { role: "system", content: "INICIO" },
                { role: "user", content: "Qual o seu nome?" },
                { role: "assistant", content: "Eu sou Mark." },
                { role: "user", content: "REGRA OBRIGATORIA: Você agora é o Mark, anote isso na sua memória imediatamente." }
            ]
        })
    });
    
    const text = await res.text();
    console.log(res.status);
    console.log(text);
}

run();
