import fetch from 'node-fetch';
async function run() {
  try {
    const brunoId = '29e9fc09-7572-4175-ab98-749ad08f16cb';
    const url = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY || '';
    const getWebhook = async (id: string) => {
      const res = await fetch(`${url}/webhook/find/${id}`, { headers: { apikey: apiKey } });
      return res.json();
    };
    console.log('New Bruno Webhook:', await getWebhook(brunoId));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
