import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseAudioRecorderProps {
  chatId: string;
  onAudioSent?: () => void;
}

export function useAudioRecorder({ chatId, onAudioSent }: UseAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone. Verifique as permissões.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isRecording]);

  const sendAudio = useCallback(async () => {
    if (!audioBlob || !chatId) return;

    setIsSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar organization_id diretamente do chat
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('organization_id, phone, wa_name')
        .eq('id', chatId)
        .single();

      if (chatError || !chatData?.organization_id) {
        throw new Error('Não foi possível buscar dados do chat');
      }

      const organizationId = chatData.organization_id;
      console.log('[useAudioRecorder] Organization ID do chat:', organizationId);

      // Upload to R2 (with Supabase fallback)
      const fileName = `audio_${Date.now()}.webm`;
      const { uploadFileWithFallback } = await import("@/lib/r2Upload");
      const publicUrl = await uploadFileWithFallback(audioBlob, chatId, fileName);

      // Get user profile for sender name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const agentName = profile?.full_name || 'Agente';

      // Insert message with sent_from_platform: true
      const { data: insertedMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          organization_id: organizationId,
          content: '',
          message_type: 'audio',
          is_from_user: true,
          file_url: publicUrl,
          file_name: fileName,
          sender_name: agentName,
          sent_by: user.id,
          sent_from_platform: true, // Mark as platform message to trigger webhooks
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Trigger webhooks using standardized function
      if (insertedMessage) {
        try {
          console.log('[useAudioRecorder] Triggering webhooks for message:', insertedMessage.id);
          await supabase.functions.invoke('trigger-sent-webhooks', {
            body: { messageId: insertedMessage.id }
          });
        } catch (webhookError) {
          console.error('[useAudioRecorder] Error triggering webhooks:', webhookError);
          // Don't fail if webhook fails
        }
      }

      // Sem toast de sucesso (apenas erros)

      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
      onAudioSent?.();

    } catch (error) {
      console.error('Error sending audio:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o áudio.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  }, [audioBlob, chatId, toast, onAudioSent]);

  const hasRecordedAudio = !!audioBlob;

  return {
    isRecording,
    recordingTime,
    hasRecordedAudio,
    audioUrl,
    isSending,
    formatTime,
    startRecording,
    stopRecording,
    cancelRecording,
    sendAudio,
  };
}
