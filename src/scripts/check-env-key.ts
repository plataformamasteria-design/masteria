
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

function getActiveKeyInfo() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        console.log('❌ ENCRYPTION_KEY is NOT set in current environment.');
        return;
    }

    console.log(`✅ ENCRYPTION_KEY is set.`);
    console.log(`📏 Length: ${key.length}`);
    console.log(`🏷️ Preview (first/last 3): ${key.substring(0, 3)}...${key.substring(key.length - 3)}`);

    const hash = crypto.createHash('sha256').update(key).digest('hex');
    console.log(`🔒 SHA-256 Hash: ${hash}`);

    const myHardcodedKey = 'pt?AFZHD}e4E<d2!R:~?WqLL}*Z>j3&rm';
    const myHash = crypto.createHash('sha256').update(myHardcodedKey).digest('hex');

    if (hash === myHash) {
        console.log('✨ MATCH! The system key matches your hardcoded key.');
    } else {
        console.log('⚠️ MISMATCH! The system key is DIFFERENT from your hardcoded key.');
        console.log(`   Mine hash: ${myHash}`);
    }
}

getActiveKeyInfo();
