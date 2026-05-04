
// src/components/atendimentos/audio-player.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AudioPlayerProps {
  src: string;
}

const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || !isFinite(timeInSeconds) || timeInSeconds < 0) {
    return "00:00";
  }
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function AudioPlayer({ src }: AudioPlayerProps): React.ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;

    const resetAudio = (): void => {
      if (audio) {
        audio.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
    resetAudio();

    if (!audio) return;

    const setAudioData = (): void => {
      if (isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const setAudioTime = (): void => setCurrentTime(audio.currentTime);
    const setAudioEnd = (): void => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', setAudioEnd);

    if (audio.readyState >= 1) {
      setAudioData();
    }

    return (): void => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', setAudioEnd);
    };
  }, [src]);

  const togglePlayPause = (): void => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(e => {
        console.error("Audio play failed", e);
        if (audio.error) {
          console.error("Audio Error Details:", {
            code: audio.error.code,
            message: audio.error.message,
            MEDIA_ERR_ABORTED: audio.error.MEDIA_ERR_ABORTED,
            MEDIA_ERR_NETWORK: audio.error.MEDIA_ERR_NETWORK,
            MEDIA_ERR_DECODE: audio.error.MEDIA_ERR_DECODE,
            MEDIA_ERR_SRC_NOT_SUPPORTED: audio.error.MEDIA_ERR_SRC_NOT_SUPPORTED
          });
        }
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (value: number[]): void => {
    const audio = audioRef.current;
    const newTime = value[0];
    if (!audio || newTime === undefined) return;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="flex items-center gap-3 w-full bg-emerald-600/20 p-2 rounded-lg">
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button variant="ghost" size="icon" onClick={togglePlayPause} className="h-10 w-10 shrink-0 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm">
        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current pl-0.5" />}
      </Button>

      <div className="flex-1 flex flex-col justify-center h-8 relative group cursor-pointer">
        {/* Waveform Visualization (Simulated) */}
        <div className="flex items-center gap-[2px] h-full w-full opacity-80">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 bg-white/60 rounded-full transition-all duration-300 ${isPlaying ? 'animate-pulse' : ''}`}
              style={{
                height: isPlaying ? `${Math.max(20, Math.random() * 100)}%` : '30%',
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>

        {/* Invisible Seek Slider Overlay */}
        <Slider
          value={[currentTime]}
          max={duration || 1}
          onValueChange={handleSliderChange}
          className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>

      <span className="text-xs font-mono text-white whitespace-nowrap min-w-[80px] text-right">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
