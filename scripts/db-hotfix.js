const { Pool } = require('pg');
require('dotenv').config();

async function applyHotfix() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('--- Applying Compatibility Hotfix ---');

        // Insert a dummy company with ID 'current-company' to satisfy FK constraints
        // while the frontend isn't updated to send real UUIDs.
        const sql = `
      INSERT INTO "companies" ("id", "name", "created_at", "updated_at") 
      VALUES ('current-company', 'Master Automation System', now(), now())
      ON CONFLICT ("id") DO UPDATE SET "name" = 'Master Automation System (Updated)';
    `;

        await client.query(sql);
        console.log('SUCCESS: Compatibility company record created.');

        client.release();
    } catch (err) {
        console.error('Hotfix failed:', err.message);
    } finally {
        await pool.end();
    }
}

applyHotfix();
