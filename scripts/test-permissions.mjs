import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testPermissions() {
    console.log("Fetching a user to test permissions column...");
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("No DATABASE_URL found.");
        process.exit(1);
    }
    
    let finalUrl = dbUrl;
    if (!finalUrl.includes('sslmode=')) {
        finalUrl += finalUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
    }

    const client = new pg.Client({
        connectionString: finalUrl
    });
    
    try {
        await client.connect();
        const res = await client.query(`SELECT id, role, permissions FROM "users" WHERE role = 'atendente' LIMIT 1;`);
        console.log("Atendente User:", res.rows[0]);
    } catch (error) {
        console.error("Error executing query:", error);
    } finally {
        await client.end();
    }
}

testPermissions();
