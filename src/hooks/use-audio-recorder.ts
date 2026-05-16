import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecorderResult {
    isRecording: boolean;
    recordingTime: number; // in seconds
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<File | null>;
    cancelRecording: () => void;
    error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderResult {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerInterval = useRef<NodeJS.Timeout | null>(null);

    // Formatter utility to ensure we export as a recognizable container/mime
    // WebM is well supported by Chrome, and accepted by WhatsApp Web as OGG/Opus.
    const getMimeType = () => {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            return 'audio/webm;codecs=opus';
        }
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            return 'audio/mp4';
        }
        return 'audio/webm'; // default fallback
    };

    const cleanup = useCallback(() => {
        if (timerInterval.current) {
            clearInterval(timerInterval.current);
            timerInterval.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            try {
                mediaRecorder.current.stop();
            } catch (e) {
                // Ignore errors on cleanup stop
            }
        }
        setIsRecording(false);
        setRecordingTime(0);
    }, []);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeType = getMimeType();
            const recorder = new MediaRecorder(stream, { mimeType });
            
            audioChunks.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunks.current.push(e.data);
                }
            };

            recorder.start();
            mediaRecorder.current = recorder;
            setIsRecording(true);
            setRecordingTime(0);

            timerInterval.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err: any) {
            console.error('Failed to start recording:', err);
            setError(err.message || 'Permissão negada ou dispositivo não encontrado.');
            cleanup();
        }
    }, [cleanup]);

    const stopRecording = useCallback((): Promise<File | null> => {
        return new Promise((resolve) => {
            if (!mediaRecorder.current || mediaRecorder.current.state === 'inactive') {
                cleanup();
                resolve(null);
                return;
            }

            mediaRecorder.current.onstop = () => {
                const mimeType = mediaRecorder.current?.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks.current, { type: mimeType });
                
                // Convert to File. We keep the real extension (webm or mp4).
                const isMp4 = mimeType.includes('mp4');
                const ext = isMp4 ? 'mp4' : 'webm';
                const finalMime = isMp4 ? 'audio/mp4' : 'audio/webm';
                
                const file = new File([audioBlob], `audio-message-${Date.now()}.${ext}`, {
                    type: finalMime
                });

                cleanup();
                resolve(file);
            };

            mediaRecorder.current.stop();
        });
    }, [cleanup]);

    const cancelRecording = useCallback(() => {
        cleanup();
    }, [cleanup]);

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        isRecording,
        recordingTime,
        startRecording,
        stopRecording,
        cancelRecording,
        error
    };
}
