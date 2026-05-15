const fetch = require('node-fetch');

async function test() {
    const token = 'EAAWZBb0ILajQBRXmRZAPIwZCDL9DgZC3ZCjcTPkcj5hOixzS2VDGGCEMmbFTQdPymvEJbTBXETu6ZCgjMHjTizwU1pcGeSidsUiHU5vZAlZAzVlWCzUunRKqDJAI01HQW493MDqZBnjqZBr8SWuBJ41zKEziqw30N98YPhbaWsZBtAybOSgXEVZC4WC3IgSDx0YBevDwmt4ppVSPWXojfOK8IlJW3uPS9JVZBwMGAWEBgadHCmZAAPaQ0ZCqXEVRZChZCQuFhRUzSfUGB5mAyVIdZBYsTrXGbNsmsDfgB6LSdbWgZDZD';
    
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "5588920008007",
        type: "text",
        text: { preview_url: false, body: "Teste com novo token temporário" }
    };
    
    const response = await fetch(`https://graph.facebook.com/v20.0/677001625502474/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log("Send Message Result:", JSON.stringify(data, null, 2));

    const appId = '1616759942244916';
    const appSecret = '4edab1b04ecdae015204b556db32c047';
    
    // access_token can be app_id|app_secret
    const response2 = await fetch(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`);
    const data2 = await response2.json();
    console.log("Token Debug Result:", JSON.stringify(data2, null, 2));
}

test();
