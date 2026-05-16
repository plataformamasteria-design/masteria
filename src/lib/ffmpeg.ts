'use server';

// Use require for better compatibility with custom server.js + tsx
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require('fluent-ffmpeg');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function convertToOgg(inputBuffer: Buffer): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `${uuidv4()}.wav`);
    const outputPath = path.join(tempDir, `${uuidv4()}.ogg`);

    try {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[FFmpeg] Converting audio: ${inputPath} -> ${outputPath}`);
        }

        // Write input buffer to temp file
        await fs.promises.writeFile(inputPath, inputBuffer);

        // Check if input is WAV (RIFF header)
        const isWav = inputBuffer.subarray(0, 4).toString('ascii') === 'RIFF';

        // Check if input is MP3 (ID3 tag or 0xFF sync byte)
        const isMP3 = inputBuffer.subarray(0, 3).toString('ascii') === 'ID3' ||
            (inputBuffer[0] === 0xFF && (inputBuffer[1] & 0xE0) === 0xE0);

        // Check if input is WebM (EBML header)
        const isWebM = inputBuffer.subarray(0, 4).toString('hex') === '1a45dfa3';

        // Convert
        await new Promise<void>((resolve, reject) => {
            let command = ffmpeg(inputPath);

            // If not WAV, not MP3, and not WebM, assume Raw PCM from Gemini (s16le, 24kHz, Mono)
            if (!isWav && !isMP3 && !isWebM) {
                if (process.env.NODE_ENV !== 'production') {
                    console.log('[FFmpeg] Input appears to be Raw PCM (Gemini format). Applying input options.');
                }
                command = command
                    .inputFormat('s16le')
                    .inputOptions([
                        '-ar 24000', // Gemini 2.5 Flash TTS uses 24kHz
                        '-ac 1'
                    ]);
            } else if (isMP3 || isWebM || isWav) {
                if (process.env.NODE_ENV !== 'production') {
                    console.log('[FFmpeg] Input detected as standard format (MP3/WAV/WebM). Auto-detecting input options.');
                }
                // Let FFmpeg auto-detect format - no special input options needed
            }

            command
                .toFormat('ogg')
                .audioCodec('libopus') // WhatsApp prefers opus in ogg container for Voice Notes
                .outputOptions([
                    '-ac 1', // Mono audio is often preferred for voice notes
                    '-ar 16000', // 16kHz sample rate is good for voice
                    '-avoid_negative_ts make_zero' // Fixes "audio unavailable" error on WhatsApp iOS
                ])
                .on('end', () => resolve())
                .on('error', (err: any) => {
                    console.error('[FFmpeg] Conversion error:', err);
                    reject(err);
                })
                .save(outputPath);
        });

        // Read output file
        const outputBuffer = await fs.promises.readFile(outputPath);
        return outputBuffer;

    } catch (error) {
        console.error('[FFmpeg] Critical error converting audio:', error);
        throw error;
    } finally {
        // Cleanup temp files
        try {
            if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
            if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
        } catch (e) {
            console.error('[FFmpeg] Error cleaning up temp files:', e);
        }
    }
}
