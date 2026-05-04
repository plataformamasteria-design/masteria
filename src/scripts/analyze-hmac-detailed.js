/**
 * Script de análise detalhada do HMAC mismatch
 * Objetivo: Identificar exatamente o que está diferente
 */

const crypto = require('crypto');
require('dotenv').config();

console.log('='.repeat(70));
console.log('🔬 ANÁLISE DETALHADA - HMAC MISMATCH');
console.log('='.repeat(70));

// App Secret from environment (REQUIRED)
const APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET;
if (!APP_SECRET) {
    console.error('❌ FACEBOOK_CLIENT_SECRET not set in environment');
    process.exit(1);
}

// DADOS REAIS DO LOG (mensagem "Teste real resposta")
const DATA = {
    // Assinatura que o Meta ENVIOU no header
    metaSent: 'sha256=3fa89205be98fa395fb2f75cfec82db7bb9bce43b170ccf12a7585f60db21822',

    // Assinatura que nosso servidor CALCULOU
    weCalculated: 'sha256=91eb7bdb864d742c4acaafe80b34518465c8a884f581584da14f90e05e8eb21a',

    // App Secret from env
    appSecret: APP_SECRET,

    // Hex dos primeiros 50 bytes do raw body
    hexFirst50: '7b226f626a656374223a22696e7374616772616d222c22656e747279223a5b7b2274696d65223a3137363735373531393337',

    // Tamanho do body original
    bodyLength: 410
};

console.log('\n📊 EVIDÊNCIAS DO LOG:');
console.log(`   Body length: ${DATA.bodyLength} bytes`);
console.log(`   App Secret: ${DATA.appSecret} (${DATA.appSecret.length} chars)`);
console.log(`   Meta enviou: ${DATA.metaSent}`);
console.log(`   Nós calculamos: ${DATA.weCalculated}`);

// Decodificar hex para texto
const first50Decoded = Buffer.from(DATA.hexFirst50, 'hex').toString('utf8');
console.log(`\n📝 Primeiros 50 bytes decodificados:`);
console.log(`   "${first50Decoded}"`);

// O payload completo do log (já parseado como JSON)
const payloadObj = {
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
};

// Versões possíveis do body stringificado
const bodyVersions = {
    'JSON.stringify (compacto)': JSON.stringify(payloadObj),
    'JSON.stringify (2 spaces)': JSON.stringify(payloadObj, null, 2),
    'JSON.stringify + \\n no final': JSON.stringify(payloadObj) + '\n',
};

console.log('\n🧪 TESTANDO DIFERENTES FORMATOS DE BODY:');
console.log('-'.repeat(70));

for (const [name, body] of Object.entries(bodyVersions)) {
    const hmac = crypto.createHmac('sha256', DATA.appSecret);
    hmac.update(body, 'utf8');
    const sig = 'sha256=' + hmac.digest('hex');

    const matchMeta = sig === DATA.metaSent ? '✅ MATCH META!' : '❌';
    const matchUs = sig === DATA.weCalculated ? '⚡ Match nosso' : '';

    console.log(`\n${name}:`);
    console.log(`   Tamanho: ${body.length} bytes`);
    console.log(`   Assinatura: ${sig}`);
    console.log(`   ${matchMeta} ${matchUs}`);

    if (matchMeta) {
        console.log('\n🎉 ENCONTRADO O FORMATO CORRETO!');
    }
}

// Testar se talvez o Meta esteja usando outro secret
console.log('\n\n🔐 ANÁLISE REVERSA - O QUE PRODUZIRIA A ASSINATURA DO META?');
console.log('-'.repeat(70));

// Se conhecemos o body e a assinatura, podemos verificar se 
// alguma variação do secret funcionaria (improvável mas vamos testar)
const secretVariations = [
    DATA.appSecret,
    DATA.appSecret.toLowerCase(),
    DATA.appSecret.toUpperCase(),
    // Talvez tenha espaços no início/fim?
    ' ' + DATA.appSecret,
    DATA.appSecret + ' ',
    DATA.appSecret.trim(),
];

console.log('Testando variações do secret...');
const testBody = JSON.stringify(payloadObj);

for (const secret of secretVariations) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(testBody, 'utf8');
    const sig = 'sha256=' + hmac.digest('hex');

    if (sig === DATA.metaSent) {
        console.log(`✅ SECRET ENCONTRADO: "${secret.replace(/./g, '*')}"`);
    }
}

// Verificar se o hex do body original corresponde ao JSON que reconstruímos
console.log('\n\n📐 COMPARAÇÃO HEX DO INÍCIO:');
console.log('-'.repeat(70));

const reconstructedHex = Buffer.from(JSON.stringify(payloadObj).substring(0, 50), 'utf8').toString('hex');
console.log(`Hex do log:          ${DATA.hexFirst50}`);
console.log(`Hex reconstruído:    ${reconstructedHex}`);

if (DATA.hexFirst50 === reconstructedHex.substring(0, DATA.hexFirst50.length)) {
    console.log('✅ Os bytes iniciais correspondem exatamente!');
} else {
    console.log('❌ DIFERENÇA ENCONTRADA nos bytes iniciais!');

    // Encontrar onde difere
    for (let i = 0; i < DATA.hexFirst50.length; i += 2) {
        const logByte = DATA.hexFirst50.substring(i, i + 2);
        const recByte = reconstructedHex.substring(i, i + 2);
        if (logByte !== recByte) {
            console.log(`   Diferença na posição ${i / 2}: log=${logByte} vs rec=${recByte}`);
            console.log(`   Caracteres: log='${String.fromCharCode(parseInt(logByte, 16))}' vs rec='${String.fromCharCode(parseInt(recByte, 16))}'`);
            break;
        }
    }
}

console.log('\n\n💡 CONCLUSÕES:');
console.log('='.repeat(70));
console.log(`
1. O App Secret está correto (confirmado no Meta Console)
2. A assinatura do Meta NÃO corresponde a nenhum formato de JSON testado
3. Isso sugere que:
   a) O Meta está calculando o HMAC sobre um body ligeiramente diferente
   b) OU está usando um secret diferente do exibido no Console
   c) OU há algum encoding específico que não estamos replicando

PRÓXIMO PASSO: Capturar o body EXATO byte-por-byte do webhook
`);
