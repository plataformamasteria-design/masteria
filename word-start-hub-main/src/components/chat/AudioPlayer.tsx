import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  className?: string;
  isFromUser?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className, isFromUser = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('audio_playback_rate') : null;
    const parsed = stored ? Number(stored) : 1;
    return parsed === 1.5 || parsed === 2 ? parsed : 1;
  });
  const audioRef = useRef<HTMLAudioElement>(null);

  const nextRate = useMemo(() => {
    if (playbackRate === 1) return 1.5;
    if (playbackRate === 1.5) return 2;
    return 1;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackRate;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleCanPlay = () => {
      setIsLoaded(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
    try {
      window.localStorage.setItem('audio_playback_rate', String(playbackRate));
    } catch {
      // ignore
    }
  }, [playbackRate]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-3 w-full min-w-[180px] max-w-[240px] sm:max-w-[280px]", className)}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Play/Pause Button */}
      <button
        onClick={togglePlayPause}
        className={cn(
          "shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-sm",
          isFromUser 
            ? "bg-white/95 text-primary hover:bg-white" 
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </button>

      {/* Speed */}
      <button
        type="button"
        onClick={() => setPlaybackRate(nextRate)}
        className={cn(
          "shrink-0 h-7 px-2 rounded-md text-[11px] font-semibold transition-colors",
          isFromUser ? "bg-white/20 text-white hover:bg-white/25" : "bg-muted text-foreground hover:bg-muted/80"
        )}
        aria-label={`Velocidade ${playbackRate}x`}
        title="Alterar velocidade"
      >
        {playbackRate}x
      </button>

      {/* Progress & Time */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Progress Bar */}
        <div className="relative h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: isFromUser ? 'rgba(255,255,255,0.3)' : 'hsl(var(--muted))' }}
        >
          <div 
            className={cn(
              "absolute left-0 top-0 h-full rounded-full transition-all",
              isFromUser ? "bg-white" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        
        {/* Time Display */}
        <div className={cn(
          "flex items-center justify-between text-[11px] font-medium",
          isFromUser ? "text-white/80" : "text-muted-foreground"
        )}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
