
require('dotenv').config();

const appId = process.env.FACEBOOK_APP_ID || '733445277925306';
const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
if (!appSecret) {
    console.error('❌ FACEBOOK_CLIENT_SECRET not set in environment');
    process.exit(1);
}
const url = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;

console.log('Testing App ID:', appId);
console.log('Testing URL:', url.replace(appSecret, 'REDACTED'));

fetch(url)
    .then(r => r.json())
    .then(data => {
        if (data.access_token) {
            console.log('✅ Success! App Access Token obtained.');
        } else {
            console.log('❌ Failed:', data);
        }
    })
    .catch(err => console.error('❌ Error:', err));
