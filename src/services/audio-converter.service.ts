
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Converts an audio buffer (typically OGG/Opus from WhatsApp) to MP3.
 * Uses temporary files for reliability with ffmpeg and ensures cleanup.
 */
export async function convertAudioToMp3(audioBuffer: Buffer): Promise<Buffer> {
    const tempInput = path.join(os.tmpdir(), `input-${uuidv4()}.ogg`);
    const tempOutput = path.join(os.tmpdir(), `output-${uuidv4()}.mp3`);

    return new Promise((resolve, reject) => {
        let isResolved = false;

        // Strict cleanup function
        const cleanup = () => {
            try {
                if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
            } catch (e) {
                console.warn('[AudioConverter] Error cleaning up temp files:', e);
            }
        };

        try {
            fs.writeFileSync(tempInput, audioBuffer);
        } catch (err) {
            cleanup();
            return reject(new Error(`Failed to write temp input file: ${err}`));
        }

        const command = ffmpeg(tempInput)
            .toFormat('mp3')
            .audioBitrate('128k')
            .on('error', (err) => {
                if (isResolved) return;
                isResolved = true;
                console.error('[AudioConverter] Conversion error:', err);
                cleanup();
                reject(err);
            })
            .on('end', () => {
                if (isResolved) return;
                isResolved = true;
                try {
                    const mp3Buffer = fs.readFileSync(tempOutput);
                    cleanup();
                    resolve(mp3Buffer);
                } catch (err) {
                    console.error('[AudioConverter] Error reading output file:', err);
                    cleanup();
                    reject(err);
                }
            });

        // Set a timeout to kill hanging processes (e.g. 30 seconds)
        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                console.warn('[AudioConverter] Conversion timed out, killing ffmpeg process');
                command.kill('SIGKILL');
                cleanup();
                reject(new Error('Audio conversion timed out'));
            }
        }, 30000);

        command.save(tempOutput);
    });
}

/**
 * Converts an audio file path to MP3 and returns the output path.
 * Optimized for memory usage by avoiding buffer loading.
 */
export async function convertAudioToMp3FromFile(inputPath: string): Promise<string> {
    const tempOutput = path.join(os.tmpdir(), `output-${uuidv4()}.mp3`);

    return new Promise((resolve, reject) => {
        let isResolved = false;

        const cleanup = () => {
            // Only clean up output on error, caller responsible for input
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
        };

        const command = ffmpeg(inputPath)
            .toFormat('mp3')
            .audioBitrate('128k')
            .on('error', (err) => {
                if (isResolved) return;
                isResolved = true;
                console.error('[AudioConverter] Conversion error:', err);
                cleanup();
                reject(err);
            })
            .on('end', () => {
                if (isResolved) return;
                isResolved = true;
                resolve(tempOutput);
            });

        // Set a timeout
        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                console.warn('[AudioConverter] Conversion timed out, killing ffmpeg process');
                command.kill('SIGKILL');
                cleanup();
                reject(new Error('Audio conversion timed out'));
            }
        }, 30000);

        command.save(tempOutput);
    });
}

/**
 * Converts an MP3 buffer to OGG Opus (required for WhatsApp Voice Notes/PTT).
 */
export async function convertMp3ToOgg(audioBuffer: Buffer): Promise<Buffer> {
    const tempInput = path.join(os.tmpdir(), `input-mp3-${uuidv4()}.mp3`);
    const tempOutput = path.join(os.tmpdir(), `output-ogg-${uuidv4()}.ogg`);

    return new Promise((resolve, reject) => {
        let isResolved = false;

        const cleanup = () => {
            try {
                if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
            } catch (e) { console.warn('Cleanup error', e); }
        };

        try {
            fs.writeFileSync(tempInput, audioBuffer);
        } catch (err) {
            cleanup();
            return reject(new Error(`Failed to write temp MP3 file: ${err}`));
        }

        const command = ffmpeg(tempInput)
            .toFormat('ogg')
            .audioCodec('libopus')
            .audioBitrate('64k') // WhatsApp optimized
            .on('error', (err) => {
                if (isResolved) return;
                isResolved = true;
                console.error('[AudioConverter] MP3->OGG error:', err);
                cleanup();
                reject(err);
            })
            .on('end', () => {
                if (isResolved) return;
                isResolved = true;
                try {
                    const oggBuffer = fs.readFileSync(tempOutput);
                    cleanup();
                    resolve(oggBuffer);
                } catch (err) {
                    cleanup();
                    reject(err);
                }
            });

        // Timeout 30s
        setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                command.kill('SIGKILL');
                cleanup();
                reject(new Error('MP3->OGG conversion timed out'));
            }
        }, 30000);

        command.save(tempOutput);
    });
}

/**
 * Gets the duration of an audio buffer in seconds using ffprobe.
 */
export async function getAudioDurationInSeconds(audioBuffer: Buffer): Promise<number> {
    const tempInput = path.join(os.tmpdir(), `probe-${uuidv4()}.ogg`);

    return new Promise((resolve) => {
        const isResolved = false;

        const cleanup = () => {
            try {
                if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            } catch (e) {
                console.warn('[AudioConverter] Error cleaning up temp probe file:', e);
            }
        };

        try {
            fs.writeFileSync(tempInput, audioBuffer);
        } catch (err) {
            console.error('[AudioConverter] Failed to write temp file for probing:', err);
            return resolve(0);
        }

        ffmpeg.ffprobe(tempInput, (err, metadata) => {
            cleanup();
            if (err) {
                console.error('[AudioConverter] ffprobe error:', err);
                return resolve(0);
            }

            const duration = metadata?.format?.duration;
            if (duration) {
                resolve(Math.ceil(Number(duration))); // Ceil to ensure non-zero for short clips
            } else {
                resolve(0);
            }
        });
    });
}
