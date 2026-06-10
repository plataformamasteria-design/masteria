import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { evolutionApiService } from './src/services/evolution-api.service';

async function test() {
    try {
        // Find connection for Bruno Macedo
        const allConns = await db.select().from(connections);
        const conns = allConns.filter(c => c.configName?.toLowerCase().includes('bruno'));
        
        let activeInstance = null;
        for (const conn of conns) {
            if (conn.connectionType !== 'evolution' && conn.connectionType !== 'baileys') continue;
            
            const instanceName = conn.sessionName || conn.id;
            console.log(`Checking connection: ${conn.configName} (Instance: ${instanceName})`);
            
            try {
                const state = await evolutionApiService.getConnectionState(instanceName);
                console.log(`State for ${instanceName}: ${JSON.stringify(state)}`);
                if (state?.instance?.state === 'open' || state?.connectionStatus === 'OPEN' || state?.state === 'open') {
                    activeInstance = instanceName;
                    break;
                }
            } catch (e: any) {
                console.log(`Error checking state: ${e.message}`);
            }
        }

        if (!activeInstance) {
            console.log("No active instance found for Bruno.");
            return;
        }

        console.log("\nUsing active instance:", activeInstance);

        const targetPhone = "5588920008007"; // Deivid Rodrigues
        
        // Generate a 1x1 transparent PNG in base64
        const pngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

        console.log("\nAttempting to send IMAGE...");
        try {
            const res = await evolutionApiService.sendMedia(
                activeInstance,
                targetPhone,
                "image",
                pngBase64,
                "Test Image from Bruno's Instance",
                "test.png",
                "image/png"
            );
            console.log("SUCCESS Image:", res);
        } catch (e: any) {
            console.error("ERROR Image:", e.message);
        }

        // Generate a simple text document in base64
        const docBase64 = "data:text/plain;base64,SGVsbG8gV29ybGQgdGVzdGUgZG9jdW1lbnRv";
        console.log("\nAttempting to send DOCUMENT...");
        try {
            const res = await evolutionApiService.sendMedia(
                activeInstance,
                targetPhone,
                "document",
                docBase64,
                undefined,
                "test.txt",
                "text/plain"
            );
            console.log("SUCCESS Document:", res);
        } catch (e: any) {
            console.error("ERROR Document:", e.message);
        }

    } catch (e: any) {
        console.error("FATAL ERRO:", e.message);
    }
    process.exit(0);
}

test();
