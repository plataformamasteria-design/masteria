import { useEffect, useState, useRef } from 'react';

export function useAudioNotifications() {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('audioNotifications');
    return saved === null ? true : saved === 'true';
  });
  const lastPlayedRef = useRef<number>(0);

  useEffect(() => {
    localStorage.setItem('audioNotifications', String(audioEnabled));
  }, [audioEnabled]);

  const toggleAudio = () => {
    setAudioEnabled(prev => !prev);
  };

  const playNotificationSound = () => {
    if (!audioEnabled) return;

    // Rate-limit: don't play if played within last 3 seconds
    const now = Date.now();
    if (now - lastPlayedRef.current < 3000) return;
    lastPlayedRef.current = now;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Two-tone notification sound
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // First tone
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, audioContext.currentTime);
      osc1.frequency.setValueAtTime(660, audioContext.currentTime + 0.1);
      
      // Second tone (harmony)
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
      osc2.frequency.setValueAtTime(880, audioContext.currentTime + 0.2);
      
      // Envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.2);
      osc2.start(audioContext.currentTime + 0.1);
      osc2.stop(audioContext.currentTime + 0.4);
      
      osc2.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        gainNode.disconnect();
        audioContext.close();
      };
    } catch (error) {
      console.error('Erro ao reproduzir som de notificação:', error);
    }
  };

  return { audioEnabled, toggleAudio, playNotificationSound };
}
