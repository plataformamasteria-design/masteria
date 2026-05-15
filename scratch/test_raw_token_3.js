const fetch = require('node-fetch');

async function test() {
    const token = 'EAAWZBb0ILajQBRd2j8aMh880ZCvD9Sjt6OcjJAZBZAXxMV2IP0KsWO0qnMqjZCYcZAoo7DVZCSJPxX6t8vEmmq56BDHjqArcHRsBHZC7x5V7jWZCmAFKRFPXkKE1bWJwSfL6gGCjofk55669ZAIAPZBOts5haZBEAZBt6EZBGukT3LCR2h4ZB8VlwEkIXEEZCEyGUtd28wZDZD';
    
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "5588920008007",
        type: "text",
        text: { preview_url: false, body: "Teste final com token permanente" }
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
    
    const response2 = await fetch(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`);
    const data2 = await response2.json();
    console.log("Token Debug Result:", JSON.stringify(data2, null, 2));
}

test();
