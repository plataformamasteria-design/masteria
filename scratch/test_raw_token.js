const fetch = require('node-fetch');

async function test() {
    const token = 'EAAWZBb0ILajQBRUAwJld9pT89bZBYWKzfx9Jx6bfqNCJ0YNocCiIZBoNLgyUgLjXZBRhhMSHCzJjbIseMUepRXbvV44qawuOTwAoLHnIMrH3tzpo6T0eht6ZAPCaHzLKELzo7nh3XH6Be3AhhdP8F9gySCvgSeZCmuQOqsXtQIchf8OL6vSFPZAbop0YBrmBExyIJ12wFK7TjfHlCZBi50hGodPF43K5utrYpGnP2EZA9drOw6DcnXyIovasb5jQFzjuQewYDiDMuEDxhJftex1sTXjBCsT0DfMZARmAZDZD';
    
    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "5588920008007",
        type: "text",
        text: { preview_url: false, body: "Teste direto" }
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
    console.log(JSON.stringify(data, null, 2));
}

test();
