import React, { useState, useRef } from 'react';
import { Upload, X, FileAudio, Image as ImageIcon, Loader2, FileText, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CommandStepFileUploadProps {
  type: 'audio' | 'image' | 'pdf' | 'video';
  fileUrl?: string;
  fileName?: string;
  organizationId: string;
  onUpload: (url: string, name: string) => void;
  onRemove: () => void;
}

export function CommandStepFileUpload({
  type,
  fileUrl,
  fileName,
  organizationId,
  onUpload,
  onRemove,
}: CommandStepFileUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getAcceptTypes = () => {
    switch (type) {
      case 'audio':
        return 'audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm';
      case 'pdf':
        return 'application/pdf';
      case 'video':
        return 'video/mp4,video/webm,video/quicktime,video/x-msvideo';
      default:
        return 'image/jpeg,image/png,image/gif,image/webp';
    }
  };

  const getMaxSize = () => {
    switch (type) {
      case 'audio':
        return 10 * 1024 * 1024; // 10MB
      case 'pdf':
        return 15 * 1024 * 1024; // 15MB
      case 'video':
        return 50 * 1024 * 1024; // 50MB
      default:
        return 5 * 1024 * 1024; // 5MB
    }
  };

  const getMaxSizeLabel = () => {
    switch (type) {
      case 'audio':
        return '10MB';
      case 'pdf':
        return '15MB';
      case 'video':
        return '50MB';
      default:
        return '5MB';
    }
  };

  const accept = getAcceptTypes();
  const maxSize = getMaxSize();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSize) {
      toast({
        title: 'Arquivo muito grande',
        description: `O arquivo deve ter no máximo ${getMaxSizeLabel()}`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Upload to R2 (with Supabase fallback)
      const { uploadFileWithFallback } = await import("@/lib/r2Upload");
      const publicUrl = await uploadFileWithFallback(file, organizationId, file.name);

      onUpload(publicUrl, file.name);

      toast({
        title: 'Arquivo enviado',
        description: file.name,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o arquivo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'audio':
        return 'Áudio';
      case 'pdf':
        return 'PDF';
      case 'video':
        return 'Vídeo';
      default:
        return 'Imagem';
    }
  };

  const getUploadLabel = () => {
    switch (type) {
      case 'audio':
        return 'um áudio';
      case 'pdf':
        return 'um PDF';
      case 'video':
        return 'um vídeo';
      default:
        return 'uma imagem';
    }
  };

  if (fileUrl) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
        {type === 'audio' ? (
          <FileAudio className="h-8 w-8 text-primary shrink-0" />
        ) : type === 'pdf' ? (
          <FileText className="h-8 w-8 text-red-500 shrink-0" />
        ) : type === 'video' ? (
          <Video className="h-8 w-8 text-blue-500 shrink-0" />
        ) : (
          <div className="relative h-16 w-16 rounded overflow-hidden shrink-0">
            <img
              src={fileUrl}
              alt={fileName || 'Preview'}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName || 'Arquivo'}</p>
          <p className="text-xs text-muted-foreground">
            {getTypeLabel()}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed transition-colors cursor-pointer',
        uploading ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
      )}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
      {uploading ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Enviando...</p>
        </>
      ) : (
        <>
          {type === 'audio' ? (
            <FileAudio className="h-6 w-6 text-muted-foreground" />
          ) : type === 'pdf' ? (
            <FileText className="h-6 w-6 text-muted-foreground" />
          ) : type === 'video' ? (
            <Video className="h-6 w-6 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground text-center">
            Clique para enviar {getUploadLabel()}
          </p>
          <p className="text-xs text-muted-foreground">
            Máximo {getMaxSizeLabel()}
          </p>
        </>
      )}
    </div>
  );
}
