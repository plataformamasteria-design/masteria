require('dotenv').config();
const { Client } = require('pg');

async function fix() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();

        // Add avatar_url to users (likely causing the /equipes crash)
        await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;`);
        console.log('Added avatar_url to users');

        // Add kanban_board_id to ai_personas (causing the follow-up queue crash)
        await client.query(`ALTER TABLE "ai_personas" ADD COLUMN IF NOT EXISTS "kanban_board_id" text;`);
        console.log('Added kanban_board_id to ai_personas');

        // Check if there's any missing column in teams or usersToTeams
        await client.query(`ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "company_id" text;`);
        await client.query(`ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "description" text;`);
        await client.query(`ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true;`);

        await client.query(`ALTER TABLE "users_to_teams" ADD COLUMN IF NOT EXISTS "company_id" text;`);

        console.log('Done.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.end();
    }
}
fix();
