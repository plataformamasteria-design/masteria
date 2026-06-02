import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
  try {
    const fetchResp = await fetch(`${process.env.EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { 'apikey': process.env.EVOLUTION_API_KEY as string }
    });
    const allInstances = await fetchResp.json();
    const openInstances = allInstances.filter((i: any) => i.connectionStatus === 'open');
    console.log(JSON.stringify(openInstances.map((i: any) => ({ name: i.name, owner: i.ownerJid, num: i.number })), null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
