import dotenv from 'dotenv';
dotenv.config();

const secret = process.env.JWT_SECRET_KEY_CALL;
console.log('Secret Length:', secret ? secret.length : 'NULL');
if (secret) {
    console.log('First 4 chars:', secret.substring(0, 4));
    console.log('Contains $M:', secret.includes('$M'));
    console.log('Last 4 chars:', secret.substring(secret.length - 4));
}
