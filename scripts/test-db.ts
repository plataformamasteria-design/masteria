import 'dotenv/config';
import postgres from 'postgres';

async function main() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error('❌ DATABASE_URL not set');
        process.exit(1);
    }

    console.log('🔍 Testing connection to:', url.split('@')[1]?.split('/')[0] || 'unknown');

    const sql = postgres(url, { ssl: 'require' });

    try {
        const result = await sql`SELECT 1 as test, NOW() as server_time`;
        console.log('✅ Conexão OK!');
        console.log('   Server time:', result[0].server_time);
    } catch (e: any) {
        console.error('❌ Erro:', e.message);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

main();
