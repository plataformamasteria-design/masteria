import pg from 'pg';

const { Client } = pg;

async function fixDb() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require',
  });

  try {
    await client.connect();
    console.log('Connected to database');
    
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_transcription text;`);
    console.log('Successfully added ai_transcription column to messages table');
    
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

fixDb();
