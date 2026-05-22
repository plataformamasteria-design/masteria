import fetch from 'node-fetch';
async function run() {
  try {
    const brunoId = '40ce44df-90a6-4dc5-8f65-8b7cdebe866b';
    const heitorId = '8f2c21fa-04be-4b26-9063-a9fc90a8f70b';
    const url = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY || '';
    const getWebhook = async (id: string) => {
      const res = await fetch(`${url}/webhook/find/${id}`, { headers: { apikey: apiKey } });
      return res.json();
    };
    console.log('Bruno Webhook:', await getWebhook(brunoId));
    console.log('Heitor Webhook:', await getWebhook(heitorId));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
