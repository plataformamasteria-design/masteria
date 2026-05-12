import fetch from 'node-fetch';

async function test() {
    const res = await fetch('http://localhost:3000/api/v1/contacts/123/events');
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('RESPONSE:', text);
}
test();
