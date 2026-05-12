import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';

interface AudioRecorderProps {
  chatId: string;
  disabled?: boolean;
}

export function AudioRecorder({ chatId, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSending, setIsSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

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
    setRecordingTime(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isRecording]);

  const sendAudio = useCallback(async () => {
    if (!audioBlob || !chatId || !currentOrganization) return;

    setIsSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

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

      // Insert message
      const { data: insertedMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          organization_id: currentOrganization.id,
          content: '',
          message_type: 'audio',
          is_from_user: true,
          file_url: publicUrl,
          file_name: fileName,
          sender_name: agentName,
          sent_by: user.id
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Trigger webhooks
      if (insertedMessage) {
        const { data: webhooks } = await (supabase as any)
          .from('webhook_configs')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .eq('webhook_type', 'sent')
          .eq('active', true);

        if (webhooks && webhooks.length > 0) {
          const { data: chat } = await supabase
            .from('chats')
            .select('phone, wa_name')
            .eq('id', chatId)
            .single();

          const payload = {
            id: insertedMessage.id,
            numero: chat?.phone,
            mensagem: '',
            tipo: 'audio',
            "from-me": true,
            chat_id: chatId,
            file_url: publicUrl,
            file_name: fileName,
            created_at: insertedMessage.created_at,
          };

          console.log('[AudioRecorder] Enviando para webhooks:', payload);

          await Promise.allSettled(
            webhooks.map(async (webhook) => {
              try {
                console.log(`[AudioRecorder] Enviando para ${webhook.name} (${webhook.url})`);
                await fetch(webhook.url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(webhook.headers as Record<string, string> || {})
                  },
                  body: JSON.stringify(payload)
                });
              } catch (err) {
                console.error('Webhook error:', err);
              }
            })
          );
        }
      }

      toast({
        title: "Áudio enviado",
        description: "O áudio foi enviado com sucesso."
      });

      setAudioBlob(null);
      setRecordingTime(0);

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
  }, [audioBlob, chatId, currentOrganization, toast]);

  // Recording state - show stop button
  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-full animate-pulse">
          <div className="w-2 h-2 bg-destructive rounded-full" />
          <span className="text-sm font-medium text-destructive">
            {formatTime(recordingTime)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={stopRecording}
          className="h-8 w-8"
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Has recorded audio - show send/cancel
  if (audioBlob) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
          <Mic className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {formatTime(recordingTime)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          disabled={isSending}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={sendAudio}
          disabled={isSending}
          className="h-8 w-8"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // Default - show record button
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startRecording}
      disabled={disabled}
      className="h-8 w-8 text-muted-foreground hover:text-primary"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}
