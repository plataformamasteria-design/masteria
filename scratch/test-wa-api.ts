async function testWhatsAppAPI() {
    const token = "EAAM4QAiHYVUBRVwxDvy1sY0tuFy9alWvrloF9FSHC5X7Jn8VudsqSuGIGmkonHqKAgNZAsenSoQt0EC0NGWWf9KYhIyWTLa3wgGgfzyns5QkPpX54LHmicW6fgSZClRxCjBYn8SC1ZCHGoCmtZBtrDG90agrTFIeaBOVgPSsoolZBjKA4ZBFzCqvGJSufuWQZDZD";
    const phoneNumberId = "3017369158294074";
    const wabaId = "738069496720828";
    
    console.log("Testing Phone Number ID...");
    try {
        const phoneRes = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const phoneData = await phoneRes.json();
        console.log("Phone Number Response:", JSON.stringify(phoneData, null, 2));
    } catch (e) {
        console.error("Fetch error (Phone):", e);
    }

    console.log("\nTesting WABA ID...");
    try {
        const wabaRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const wabaData = await wabaRes.json();
        console.log("WABA Response:", JSON.stringify(wabaData, null, 2));
    } catch (e) {
        console.error("Fetch error (WABA):", e);
    }
}

testWhatsAppAPI();
