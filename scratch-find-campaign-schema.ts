import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  const res = await client.query(`SELECT * FROM campaigns WHERE id = 'a92b6169-ca99-41c9-9c61-feac6a0d419c'`);
  console.log('Campaign columns:', Object.keys(res.rows[0]));
  
  const res2 = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_delivery_reports'`);
  console.log('Delivery reports columns:', res2.rows.map(r => r.column_name));
  
  const countRes = await client.query(`SELECT count(*) FROM whatsapp_delivery_reports WHERE campaign_id = 'a92b6169-ca99-41c9-9c61-feac6a0d419c'`);
  console.log('Delivery reports count for campaign:', countRes.rows[0].count);

  await client.end();
}

main().catch(console.error);
