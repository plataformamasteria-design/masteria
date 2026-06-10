import { evolutionApiService } from './src/services/evolution-api.service';

async function test() {
    const instanceName = "29e9fc09-7572-4175-ab98-749ad08f16cb"; // Bruno's instance
    const phone = "5588920008007"; // Deivid Rodrigues
    
    // Tiny MP3/OGG base64
    const audioBase64Raw = "UklGRiQAAABXRUJBV0FWRU1URiQAAABIAAAAAQAAACcAAABRAAAARklGRgAAAAA="; // Fake small buffer just to test validation
    const audioBase64Prefixed = `data:audio/ogg;base64,${audioBase64Raw}`;

    console.log("Testing AUDIO RAW base64...");
    try {
        const res1 = await evolutionApiService.sendMedia(instanceName, phone, "audio", audioBase64Raw, undefined, "audio.ogg", "audio/ogg");
        console.log("SUCCESS AUDIO RAW:", res1);
    } catch(e: any) { console.error("ERROR AUDIO RAW:", e.message); }

    console.log("\nTesting AUDIO PREFIXED base64...");
    try {
        const res2 = await evolutionApiService.sendMedia(instanceName, phone, "audio", audioBase64Prefixed, undefined, "audio.ogg", "audio/ogg");
        console.log("SUCCESS AUDIO PREFIXED:", res2);
    } catch(e: any) { console.error("ERROR AUDIO PREFIXED:", e.message); }
    
    process.exit(0);
}

test();
