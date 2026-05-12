const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  return client.query(`SELECT id, connection_type, config_name FROM connections WHERE id IN ('b4e9e25a-ef82-44ca-b962-28e649848dda', 'c4bf775b-9ac8-42bf-8ed5-5c0512461984')`);
}).then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}).catch(console.error);
