async function run() {
  const { db } = require('../src/lib/db');
  const { marketingCredentials } = require('../src/lib/db/schema');
  
  const creds = await db.select().from(marketingCredentials).limit(1);
  if (!creds || creds.length === 0) { console.log('No creds'); return; }
  
  const token = creds[0].credentials.access_token;
  const accountId = creds[0].credentials.ad_account_id;
  const act = accountId.startsWith('act_') ? accountId : 'act_' + accountId;
  
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  
  const timeRange = JSON.stringify({since: since, until: until});
  const url = `https://graph.facebook.com/v21.0/${act}/insights?access_token=${token}&fields=campaign_id,objective,actions&time_range=${encodeURIComponent(timeRange)}&level=campaign`;
  
  const r = await fetch(url);
  const data = await r.json();
  console.log(JSON.stringify(data.data, null, 2));
  process.exit(0);
}
run().catch(console.error);
