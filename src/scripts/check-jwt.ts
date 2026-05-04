
import { SignJWT, jwtVerify } from 'jose';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY_CALL;

async function test() {
    if (!JWT_SECRET_KEY) {
        console.log('NO SECRET');
        return;
    }
    const secretKey = new TextEncoder().encode(JWT_SECRET_KEY);
    console.log('Secret:', JWT_SECRET_KEY);
    console.log('Length:', JWT_SECRET_KEY.length);

    const token = await new SignJWT({ test: true })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(secretKey);

    console.log('Token signed.');

    try {
        const { payload } = await jwtVerify(token, secretKey);
        console.log('Verification Success:', payload);
    } catch (e) {
        console.log('Verification Failed:', e.message);
    }
}

test();
