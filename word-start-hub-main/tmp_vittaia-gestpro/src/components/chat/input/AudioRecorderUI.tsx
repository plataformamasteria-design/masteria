import React, { useState } from 'react';
import { X, Mic, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AudioRecorderUI({
    isRecording,
    hasRecordedAudio,
    recordingTime,
    formatTime,
    audioUrl,
    cancelRecording,
}: any) {
    const [isPreviewingAudio, setIsPreviewingAudio] = useState(false);

    if (isRecording) {
        return (
            <div className="flex-1 flex items-center gap-2 px-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-full animate-pulse">
                    <div className="w-2 h-2 bg-destructive rounded-full" />
                    <span className="text-sm font-medium text-destructive">
                        {formatTime(recordingTime)}
                    </span>
                </div>
                <span className="text-sm text-muted-foreground hidden sm:inline">Gravando...</span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelRecording}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive ml-auto"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    if (hasRecordedAudio) {
        return (
            <div className="flex-1 flex items-center gap-2 px-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                    <Mic className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                        {formatTime(recordingTime)}
                    </span>
                </div>
                {audioUrl && (
                    <button
                        onClick={() => setIsPreviewingAudio(!isPreviewingAudio)}
                        className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                        title="Ouvir preview"
                    >
                        <Play className="h-3.5 w-3.5 text-primary" />
                    </button>
                )}
                {isPreviewingAudio && audioUrl && (
                    <audio src={audioUrl} autoPlay onEnded={() => setIsPreviewingAudio(false)} className="hidden" />
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelRecording}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive ml-auto"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return null;
}
