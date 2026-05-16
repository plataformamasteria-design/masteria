const http = require('http');

const data = JSON.stringify({
  ruleId: 'e47dc1f0-2be5-4023-89a3-b06f93b19c99',
  nodeId: 'ai_agent_1778941298331',
  virtual_history: [],
  system_message: 'Test message',
  existing_notes: 'Test note',
  manualUpdate: true
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/automations/simulator/memory',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    // Need a valid session cookie to test this.
  }
}, (res: any) => {
  let body = '';
  res.on('data', (c: string) => body += c);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.write(data);
req.end();
