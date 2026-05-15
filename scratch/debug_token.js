const fetch = require('node-fetch');

async function checkToken() {
    const inputToken = 'EAAWZBb0ILajQBRUAwJld9pT89bZBYWKzfx9Jx6bfqNCJ0YNocCiIZBoNLgyUgLjXZBRhhMSHCzJjbIseMUepRXbvV44qawuOTwAoLHnIMrH3tzpo6T0eht6ZAPCaHzLKELzo7nh3XH6Be3AhhdP8F9gySCvgSeZCmuQOqsXtQIchf8OL6vSFPZAbop0YBrmBExyIJ12wFK7TjfHlCZBi50hGodPF43K5utrYpGnP2EZA9drOw6DcnXyIovasb5jQFzjuQewYDiDMuEDxhJftex1sTXjBCsT0DfMZARmAZDZD';
    const appId = '1616759942244916';
    const appSecret = '4edab1b04ecdae015204b556db32c047';
    
    // access_token can be app_id|app_secret
    const response = await fetch(`https://graph.facebook.com/debug_token?input_token=${inputToken}&access_token=${appId}|${appSecret}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

checkToken();
