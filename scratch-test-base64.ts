import { evolutionApiService } from './src/services/evolution-api.service';

async function test() {
    const instanceName = "29e9fc09-7572-4175-ab98-749ad08f16cb";
    const phone = "5588920008007";
    
    // Raw Base64
    const rawBase64 = "SGVsbG8gV29ybGQ=";
    const prefixedBase64 = "data:text/plain;base64,SGVsbG8gV29ybGQ=";

    console.log("Testing RAW base64...");
    try {
        const res1 = await evolutionApiService.sendMedia(instanceName, phone, "document", rawBase64, undefined, "test-raw.txt", "text/plain");
        console.log("SUCCESS RAW:", res1);
    } catch(e: any) { console.error("ERROR RAW:", e.message); }

    console.log("\nTesting PREFIXED base64...");
    try {
        const res2 = await evolutionApiService.sendMedia(instanceName, phone, "document", prefixedBase64, undefined, "test-prefixed.txt", "text/plain");
        console.log("SUCCESS PREFIXED:", res2);
    } catch(e: any) { console.error("ERROR PREFIXED:", e.message); }
    
    process.exit(0);
}

test();
