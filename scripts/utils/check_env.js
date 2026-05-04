const { Client } = require(pg);

console.log(--- Environment Variables Check ---);
const relevantKeys = [REPLIT_DB_URL, DATABASE_URL, PGUSER, PGHOST, PGPASSWORD, PGDATABASE, PGPORT];
relevantKeys.forEach(key => {
  if (process.env[key]) {
    console.log(\: Exists (\...)\);
  } else {
    console.log(\: Not Found\);
  }
});

console.log(\n--- Database Connection Check ---);
const dbUrl = process.env.DATABASE_URL || process.env.REPLIT_DB_URL;

if (!dbUrl) {
  console.error(No database URL found.);
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
});

client.connect()
  .then(() => {
    console.log(Successfully connected to the database!);
    return client.query(SELECT NOW());
  })
  .then(res => {
    console.log(Database Time:, res.rows[0].now);
    return client.end();
  })
  .catch(err => {
    console.error(Connection error:, err);
    process.exit(1);
  });
