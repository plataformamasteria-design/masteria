import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Video, Upload, X } from "lucide-react";

interface SendVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/mpeg"];

export const SendVideoDialog: React.FC<SendVideoDialogProps> = ({
  open,
  onOpenChange,
  chatId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas vídeos MP4, WebM ou MOV são aceitos",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O vídeo deve ter no máximo 50MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!selectedFile) {
      toast({
        title: "Selecione um vídeo",
        description: "Você precisa selecionar um vídeo para enviar",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select("organization_id")
        .eq("id", chatId)
        .single();

      if (chatError || !chatData?.organization_id) {
        throw new Error("Não foi possível buscar dados do chat");
      }

      // Gerar nome único para o arquivo
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${chatId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      setUploadProgress(20);

      // Upload para o Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(fileName, selectedFile, {
          contentType: selectedFile.type,
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Falha ao fazer upload do vídeo");
      }

      setUploadProgress(70);

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from("chat-files")
        .getPublicUrl(uploadData.path);

      setUploadProgress(85);

      // Criar mensagem
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .insert([{
          chat_id: chatId,
          organization_id: chatData.organization_id,
          message_type: "video",
          file_url: urlData.publicUrl,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          is_from_user: true,
          sent_by: user.id,
          sent_from_platform: true, // Mark as platform message to trigger webhooks
        }])
        .select()
        .single();

      if (messageError) throw messageError;

      setUploadProgress(95);

      // Chamar edge function para disparar webhooks
      console.log('[SendVideoDialog] Triggering sent webhooks for message:', messageData.id);
      const { error: webhookError } = await supabase.functions.invoke('trigger-sent-webhooks', {
        body: { messageId: messageData.id }
      });

      if (webhookError) {
        console.error('[SendVideoDialog] Error triggering webhooks:', webhookError);
        // Não bloquear o fluxo, a mensagem já foi salva
      }

      setUploadProgress(100);

      toast({
        title: "Vídeo enviado",
        description: "O vídeo foi enviado com sucesso",
      });

      clearSelection();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao enviar vídeo:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível enviar o vídeo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      clearSelection();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-500" />
            Enviar Vídeo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!selectedFile ? (
            <div className="space-y-2">
              <Label>Selecione um vídeo</Label>
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar ou arraste um vídeo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  MP4, WebM ou MOV (máx. 50MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/mpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Vídeo selecionado</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {previewUrl && (
                <video
                  src={previewUrl}
                  controls
                  className="w-full rounded-lg max-h-48 object-contain bg-black"
                />
              )}
              
              <p className="text-sm text-muted-foreground truncate">
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>

              {uploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Enviando... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={uploading || !selectedFile}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
