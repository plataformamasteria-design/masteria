import fetch from 'node-fetch';

async function run() {
    const res = await fetch('http://localhost:3000/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ruleId: '8a11daba-6795-43f5-8c72-cdb59ec6f11e',
            nodeId: 'ai_agent_1778963902000',
            notes: 'NEW MEMORY INJECTED VIA DEBUG POST'
        })
    });
    
    const text = await res.text();
    console.log(res.status);
    console.log(text);
}

run();
