/**
 * Script para testar cálculo HMAC localmente
 * Usa os dados reais capturados do log do servidor
 */

const crypto = require('crypto');
require('dotenv').config();

// App Secret from environment (REQUIRED)
const APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET;
if (!APP_SECRET) {
    console.error('❌ FACEBOOK_CLIENT_SECRET not set in environment');
    process.exit(1);
}

// Dados do log real (primeira mensagem recebida)
const LOG_DATA = {
    // Assinatura que o Meta enviou
    signatureReceived: 'sha256=3fa89205be98fa395fb2f75cfec82db7bb9bce43b170ccf12a7585f60db21822',

    // Assinatura que calculamos
    signatureExpected: 'sha256=91eb7bdb864d742c4acaafe80b34518465c8a884f581584da14f90e05e8eb21a',

    // Hex dump dos primeiros 50 bytes
    hexDump: '7b226f626a656374223a22696e7374616772616d222c22656e747279223a5b7b2274696d65223a3137363735373531393337',

    // Tamanho do body
    bodyLength: 410,

    // Preview do payload
    payloadPreview: '{"object":"instagram","entry":[{"time":1767575193792,"id":"17841401066086910","m...'
};

console.log('🔍 Análise de HMAC Mismatch\n');
console.log('='.repeat(60));

// Decodificar o hex dump para ver o texto
const hexBytes = Buffer.from(LOG_DATA.hexDump, 'hex');
console.log('\n📦 Primeiros 50 bytes do body (decodificado):');
console.log(`   "${hexBytes.toString('utf8')}"`);

// Verificar se corresponde ao preview
console.log('\n📋 Preview do payload:');
console.log(`   "${LOG_DATA.payloadPreview}"`);

// Reconstruir o body a partir do hex (parcial)
console.log('\n🔧 Testando cálculo HMAC:');

// Simular o body completo baseado no payload do log
const testBody = JSON.stringify({
    "object": "instagram",
    "entry": [
        {
            "time": 1767575193792,
            "id": "17841401066086910",
            "messaging": [
                {
                    "sender": { "id": "1896097054661185" },
                    "recipient": { "id": "17841401066086910" },
                    "timestamp": 1767575193382,
                    "message": {
                        "mid": "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDAxMDY2MDg2OTEwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTg4NzQ1MDQ5MzkwODgwMzozMjYwNjAwNzIyMzM2MDMyOTk5MzY3NTMxNzM0NjA0MTg1NgZDZD",
                        "text": "Teste real resposta"
                    }
                }
            ]
        }
    ]
});

console.log(`\n📏 Tamanho do body reconstruído: ${testBody.length} bytes`);
console.log(`📏 Tamanho do body original: ${LOG_DATA.bodyLength} bytes`);

// Calcular HMAC
const hmac = crypto.createHmac('sha256', APP_SECRET);
hmac.update(testBody, 'utf8');
const calculatedSig = 'sha256=' + hmac.digest('hex');

console.log('\n🔐 Comparação de assinaturas:');
console.log(`   Meta enviou:    ${LOG_DATA.signatureReceived}`);
console.log(`   Nós calculamos: ${calculatedSig}`);
console.log(`   Log calculou:   ${LOG_DATA.signatureExpected}`);

// Verificar diferença de tamanho
const sizeDiff = Math.abs(testBody.length - LOG_DATA.bodyLength);
console.log(`\n📊 Diferença de tamanho: ${sizeDiff} bytes`);

if (sizeDiff === 0) {
    console.log('   ✅ Tamanhos iguais - body provavelmente correto');
} else {
    console.log('   ⚠️ Tamanhos diferentes - Meta pode estar enviando formato diferente');
    console.log('   Possíveis causas:');
    console.log('   - Espaçamento/formatação diferente no JSON');
    console.log('   - Campos adicionais não visíveis no log');
}

// Testar com diferentes encodings
console.log('\n🧪 Testando diferentes encodings:');

const encodings = ['utf8', 'ascii', 'latin1', 'binary'];
encodings.forEach(enc => {
    const h = crypto.createHmac('sha256', APP_SECRET);
    h.update(testBody, enc);
    const sig = 'sha256=' + h.digest('hex');
    const match = sig === LOG_DATA.signatureReceived ? '✅' : '❌';
    console.log(`   ${enc}: ${sig.substring(0, 30)}... ${match}`);
});

console.log('\n' + '='.repeat(60));
console.log('📌 CONCLUSÃO:');
console.log('   O Meta está usando um body EXATAMENTE como foi recebido');
console.log('   Mas nosso servidor pode estar modificando o body antes');
console.log('   de calcular o HMAC (whitespace, order, etc.)');
console.log('\n   SOLUÇÃO: Usar rawBody diretamente do request SEM parsear');
