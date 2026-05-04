require('dotenv').config();
const { Client } = require('pg');

async function createTables() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();

        console.log('Creating teams table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "teams" (
                "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
                "company_id" text NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
                "name" text NOT NULL,
                "description" text,
                "active" boolean NOT NULL DEFAULT true,
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            );
        `);

        console.log('Creating users_to_teams table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS "users_to_teams" (
                "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "team_id" text NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
                "company_id" text REFERENCES "companies"("id") ON DELETE CASCADE,
                "created_at" timestamp DEFAULT now() NOT NULL,
                PRIMARY KEY ("user_id", "team_id")
            );
        `);

        console.log('Tables created successfully.');
    } catch (e) {
        console.error('Error creating tables:', e);
    } finally {
        await client.end();
    }
}
createTables();
