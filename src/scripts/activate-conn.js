
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
        console.log('Activating connection "5865"...');
        const result = await sql`
            UPDATE connections 
            SET is_active = true 
            WHERE config_name = '5865'
            RETURNING id, config_name, is_active
        `;

        if (result.length === 0) {
            console.error('❌ Connection "5865" not found.');
        } else {
            console.log('✅ Connection activated:', result[0]);
        }

    } catch (err) {
        console.error('❌ Update failed:', err);
    } finally {
        await sql.end();
    }
}

main();
