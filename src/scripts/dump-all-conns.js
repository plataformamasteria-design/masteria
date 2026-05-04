
import postgres from 'postgres';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL missing.');
    process.exit(1);
}

async function main() {
    const sql = postgres(DATABASE_URL);

    try {
        const results = await sql`
            SELECT id, config_name, phone_number_id, waba_id, is_active, connection_type 
            FROM connections 
            ORDER BY created_at DESC
        `;

        console.log('--- All Connections ---');
        console.table(results.map(row => ({
            Name: row.config_name,
            PhoneID: row.phone_number_id,
            Active: row.is_active,
            Type: row.connection_type
        })));

    } catch (err) {
        console.error('Query failed:', err);
    } finally {
        await sql.end();
    }
}

main();
