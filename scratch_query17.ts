import fetch from 'node-fetch';
async function run() {
  try {
    const brunoId = '40ce44df-90a6-4dc5-8f65-8b7cdebe866b';
    const url = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY || '';
    const res = await fetch(`${url}/message/sendText/${brunoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: '5588920008007', text: 'Test send' })
    });
    console.log('Send Text Result:', await res.json());
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
