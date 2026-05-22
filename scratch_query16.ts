import fetch from 'node-fetch';
async function run() {
  try {
    const brunoId = '40ce44df-90a6-4dc5-8f65-8b7cdebe866b';
    const url = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY || '';
    const getState = async (id: string) => {
      const res = await fetch(`${url}/instance/connectionState/${id}`, { headers: { apikey: apiKey } });
      return res.json();
    };
    console.log('Bruno State:', await getState(brunoId));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
