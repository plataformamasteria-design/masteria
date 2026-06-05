import * as fs from 'fs';

// Test POST /api/v1/agent-library with a real image file

async function testUpload() {
    // Create a small test PNG (1x1 red pixel)
    const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
        0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
        0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    // Build FormData manually
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW';
    const crlf = '\r\n';
    
    const body = Buffer.concat([
        Buffer.from(`--${boundary}${crlf}`),
        Buffer.from(`Content-Disposition: form-data; name="file"; filename="test.png"${crlf}`),
        Buffer.from(`Content-Type: image/png${crlf}${crlf}`),
        pngBuffer,
        Buffer.from(`${crlf}--${boundary}${crlf}`),
        Buffer.from(`Content-Disposition: form-data; name="nodeId"${crlf}${crlf}`),
        Buffer.from(`test_node_${Date.now()}${crlf}`),
        Buffer.from(`--${boundary}--${crlf}`),
    ]);

    console.log('📤 Testando POST /api/v1/agent-library...');
    
    const res = await fetch('http://localhost:3000/api/v1/agent-library', {
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            // Need to send session cookie - will fail without auth but tell us if route compiles
            'Cookie': '__session=test',
        },
        body,
    });
    
    const text = await res.text();
    console.log(`📬 Status: ${res.status}`);
    console.log(`📄 Response: ${text.substring(0, 200)}`);
    
    if (res.status === 401 || text.includes('Não autorizado') || text.includes('autorizado')) {
        console.log('✅ Rota compilou OK! (Erro de auth é esperado sem cookie válido)');
    } else if (res.status === 201) {
        console.log('🎉 Upload bem sucedido!');
    } else {
        console.log('⚠️ Resposta inesperada');
    }
    
    // Also test GET
    console.log('\n📤 Testando GET /api/v1/agent-library?nodeId=test...');
    const res2 = await fetch('http://localhost:3000/api/v1/agent-library?nodeId=test', {
        headers: { 'Cookie': '__session=test' }
    });
    const text2 = await res2.text();
    console.log(`📬 Status: ${res2.status}`);
    console.log(`📄 Response: ${text2.substring(0, 200)}`);
}

testUpload().catch(e => console.error('Error:', e.message));
