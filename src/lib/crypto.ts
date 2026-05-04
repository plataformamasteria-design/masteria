// src/lib/crypto.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const CRYPTO_SINGLETON_KEY = '__master_ia_crypto_singleton__' as const;
const CRYPTO_WARNING_KEY = '__master_ia_crypto_warning_logged__' as const;

interface CryptoSingleton {
  key: Buffer;
}

interface GlobalCrypto {
  [CRYPTO_SINGLETON_KEY]?: CryptoSingleton;
  [CRYPTO_WARNING_KEY]?: boolean;
}

const globalCrypto = globalThis as unknown as GlobalCrypto;

function initializeEncryptionKey(): Buffer {
  if (globalCrypto[CRYPTO_SINGLETON_KEY]) {
    return globalCrypto[CRYPTO_SINGLETON_KEY].key;
  }

  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY must be set in environment variables.');
  }

  let key: Buffer;
  
  if (ENCRYPTION_KEY.length === 32) {
    key = Buffer.from(ENCRYPTION_KEY, 'utf-8');
  } else {
    key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    
    if (!globalCrypto[CRYPTO_WARNING_KEY]) {
      // console.log('⚠️ [Crypto] ENCRYPTION_KEY was hashed to 32 bytes for compatibility (this message appears only once).');
      globalCrypto[CRYPTO_WARNING_KEY] = true;
    }
  }

  globalCrypto[CRYPTO_SINGLETON_KEY] = { key };
  return key;
}

const key = initializeEncryptionKey();

export function encrypt(text: string): string {
  if (!text) {
    return text;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

export function decrypt(encryptedHex: string): string {
  if (!encryptedHex) {
    return encryptedHex;
  }
  try {
    const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error("Decryption failed:", error);
    // Return an empty string or a specific error indicator if decryption fails
    // This can happen if the data was not encrypted or used a different key
    return '';
  }
}
