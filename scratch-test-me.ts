async function main() {
    const token = 'EAAMNZBpcDzagBRrw54ZB3YuF3TKYhxDOxo1CXYbwJjp99KNY8ZCtf81SPZAr9Wy11VZCGJxz2QABHSll85Udz5t8pHsy3Ua3OjQLPvJq4ZCZCdgjTIuzn7nUcEGPT9MMEjUTP8icQzhrH52d6amRXrfraEvk1lCXBM45iUzgpiuTccL4vfmBqQ0aK1N0bTFWwZDZD';
    
    const url = `https://graph.facebook.com/v20.0/me`;
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log("Me Response:", JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
