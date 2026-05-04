// Trigger the webhook with correct data
const https = require('https');

const data = JSON.stringify({
    nome: 'Deivid Rodrigues',
    email: 'deivid@masteria.app',
    whatsapp: '(88) 9 9216-1399',
    objetivo: ['Deixar dinheiro para alguem'],
    investimento: 'Ate R$200 mil',
    importante: 'Aumentar o valor de resgate',
    datadenascimento: '15/05/1990',
    profissao: 'Empresario',
    doenca: 'Nao',
    cirurgia: 'Nao',
});

const options = {
    hostname: 'masteria.app',
    path: '/api/v1/automation-flows/webhook-trigger/testform',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
    },
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body);
    });
});

req.on('error', (e) => console.error('Error:', e));
req.write(data);
req.end();
