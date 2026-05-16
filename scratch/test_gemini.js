const http = require('http');

const data = JSON.stringify({
    simulate_ai_virtual: true,
    config: { model: 'gemini-2.0-flash', system_message: 'You are a test.' },
    virtual_history: [{ role: 'user', content: 'hello' }]
});

const req = http.request('http://localhost:3000/api/v1/automations/simulator', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', console.error);
req.write(data);
req.end();
