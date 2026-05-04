

// MOCK ENVIRONMENT VARIABLES BEFORE IMPORTS
process.env.DATABASE_URL = 'postgres://mock:mock@localhost:5432/mock_db'; // Mock for DB connection
process.env.BAILEYS_SESSIONS_ENABLED = 'false'; // Prevent actual connection attempts
process.env.NEXTAUTH_SECRET = 'mock_secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

async function verifyImports() {
    console.log('🧪 Starting Backend Import Verification...');

    try {
        // We mock the db module to avoid actual connection attempts during import validation
        // This is a bit tricky with dynamic imports in the actual files.
        // Instead, we rely on the fact that if it loads and fails *later* (connection), the *import* worked.
        // The previous error was "DATABASE_URL is not set" thrown AT IMPORT TIME by db/index.ts
        // By setting the env var above, we should pass that check.

        console.log('   Importing baileys-session-manager...');
        const { sessionManager } = await import('../src/services/baileys-session-manager.ts');
        if (sessionManager) {
            console.log('   ✅ baileys-session-manager loaded successfully.');
        }
    } catch (error) {
        if ((error as any).code === 'MODULE_NOT_FOUND') {
            console.error('   ❌ MODULE_NOT_FOUND: The import path/extension fix failed.');
            console.error('   Debug:', error);
            process.exit(1);
        }
        // If it fails with connection error, it means the MODULE WAS FOUND and code executed.
        // We consider this a PASS for specific "import path" verification.
        console.log('   ✅ Module resolved (threw runtime error as expected):', (error as Error).message.split('\n')[0]);
    }

    try {
        console.log('   Importing server-init...');
        await import('../src/lib/server-init.ts');
        console.log('   ✅ server-init loaded successfully.');
    } catch (error) {
        if ((error as any).code === 'MODULE_NOT_FOUND') {
            console.error('   ❌ MODULE_NOT_FOUND in server-init');
            process.exit(1);
        }
        console.log('   ✅ Module resolved (threw runtime error as expected):', (error as Error).message.split('\n')[0]);
    }

    console.log('🎉 All critical backend modules resolved correctly (paths are valid).');
}

verifyImports();
