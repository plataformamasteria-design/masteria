import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { evolutionApiService } from './src/services/evolution-api.service';

async function test() {
    try {
        const instances = await evolutionApiService.fetchAllInstances();
        console.log("Evolution API instances:");
        
        // Find an instance that is "open" or "connected"
        const activeInstances = Array.isArray(instances) ? instances : Object.values(instances);
        const active = activeInstances.find((i: any) => i?.instance?.state === 'open' || i?.connectionStatus === 'OPEN');
        
        if (active) {
            const name = active.instance?.instanceName || active.name;
            console.log("Found active instance:", name);
            
            // Try to send a simple image or document to test the API directly
            try {
                const res = await fetch(`${process.env.EVOLUTION_API_URL}/message/sendMedia/${name}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': process.env.EVOLUTION_API_KEY as string },
                    body: JSON.stringify({
                        number: "5588920008007", // The user's number
                        mediatype: "document",
                        media: "data:text/plain;base64,SGVsbG8gV29ybGQ=",
                        fileName: "test.txt",
                        // mimetype: "text/plain" // Let's see if adding mimetype helps
                    })
                });
                console.log("Without mimetype:", await res.text());
                
                const res2 = await fetch(`${process.env.EVOLUTION_API_URL}/message/sendMedia/${name}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': process.env.EVOLUTION_API_KEY as string },
                    body: JSON.stringify({
                        number: "5588920008007", 
                        mediatype: "document",
                        mimetype: "text/plain",
                        media: "data:text/plain;base64,SGVsbG8gV29ybGQ=",
                        fileName: "test.txt",
                    })
                });
                console.log("With mimetype:", await res2.text());
            } catch (e: any) {
                console.error("Fetch error:", e.message);
            }
        } else {
            console.log("No active instance found in Evolution API");
        }

    } catch (e: any) {
        console.error("ERRO:", e.message);
    }
    process.exit(0);
}

test();
