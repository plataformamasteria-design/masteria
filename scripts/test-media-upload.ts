
import { queueMediaUpload, initializeMediaUploadQueue, closeMediaUploadQueue } from '../src/services/media-upload-queue.service';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config();

// FORCE LOCAL REDIS for this test to avoid Upstash connection issues
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.REDIS_URL;
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';

async function testLargeUpload() {
    console.log('🧪 Starting Large Media Upload Test...');

    await initializeMediaUploadQueue();

    // Create a 12MB dummy buffer
    const size = 12 * 1024 * 1024;
    const buffer = Buffer.alloc(size, 'a');

    console.log(`📦 Created buffer of size: ${(size / 1024 / 1024).toFixed(2)}MB`);

    try {
        const key = `test/large-file-${uuidv4()}.bin`;
        const result = await queueMediaUpload(
            'test-connection',
            'test-company',
            key,
            buffer,
            'application/octet-stream',
            undefined,
            1
        );

        if (result) {
            console.log('✅ Upload successful! URL:', result);
        } else {
            console.error('❌ Upload returned null');
        }
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        await closeMediaUploadQueue();
        console.log('👋 Test complete');
        process.exit(0);
    }
}

testLargeUpload();
