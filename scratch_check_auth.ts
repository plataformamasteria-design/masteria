import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const res = await pool.query("SELECT count(*) as c FROM baileys_auth_store WHERE connection_id = '70fe289c-a77e-4e57-b278-38924f022b62'");
    console.log('Records:', res.rows[0].c);
    process.exit(0);
}

main();
