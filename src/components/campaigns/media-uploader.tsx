// src/components/campaigns/media-uploader.tsx

'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MediaLibraryDialog } from './media-library-dialog';
import { UploadCloud, X, File as FileIcon, Video, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { MediaAsset, HeaderType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { useRouter } from 'next/navigation';

interface MediaUploaderProps {
  mediaType?: HeaderType | null;
  selectedMedia: MediaAsset | null;
  connectionId: string;
  onMediaSelect: (media: MediaAsset | null) => void;
  onHandleGenerated: (handleId: string | null) => void;
}

const MediaIcon = ({ type }: { type: HeaderType | null | undefined }) => {
  switch (type) {
    case 'IMAGE':
      return <ImageIcon className="h-10 w-10 text-muted-foreground" />;
    case 'VIDEO':
      return <Video className="h-10 w-10 text-muted-foreground" />;
    case 'DOCUMENT':
      return <FileIcon className="h-10 w-10 text-muted-foreground" />;
    default:
      return null;
  }
};


export function MediaUploader({
  mediaType,
  onMediaSelect,
  selectedMedia,
  connectionId,
  onHandleGenerated,
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [isGeneratingHandle, setIsGeneratingHandle] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB
    if (file.size > MAX_FILE_SIZE) {
        notify.error('Ficheiro Muito Grande', 'O tamanho do ficheiro não pode exceder 12MB.');
        return;
    }

    setUploading(true);
    setFileName(file.name);
    // Fake progress for better UX
    setProgress(0);
    const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/media/upload-url', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Falha no upload da mídia.');
      }
      
      const newAsset: MediaAsset = await res.json();
      setProgress(100);
      onMediaSelect(newAsset);
      
      notify.success('Upload Concluído!', 'Sua mídia foi adicionada à galeria.');
      router.refresh(); // Refresh gallery
    } catch (error) {
      notify.error('Erro de Upload', (error as Error).message);
    } finally {
        clearInterval(progressInterval);
        setUploading(false);
    }
  };

  useEffect(() => {
    const generateHandle = async () => {
      if (selectedMedia && connectionId) {
        setIsGeneratingHandle(true);
        onHandleGenerated(null); // Reset previous handle
        try {
          const res = await fetch(`/api/v1/media/${selectedMedia.id}/handle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Falha ao obter ID da Meta.');
          onHandleGenerated(data.handle);
        } catch (error) {
          notify.error('Erro de Processamento', `Não foi possível processar a mídia com a Meta: ${(error as Error).message}`);
        } finally {
          setIsGeneratingHandle(false);
        }
      }
    };
    generateHandle();
  }, [selectedMedia, connectionId, onHandleGenerated, notify]);


  const handleRemoveMedia = async () => {
    if (selectedMedia && window.confirm('Deseja remover esta mídia permanentemente?')) {
      try {
        const res = await fetch(`/api/v1/media/${selectedMedia.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Falha ao deletar mídia');
        notify.success('Mídia removida com sucesso!');
        router.refresh();
      } catch (error) {
        notify.error('Erro', (error as Error).message);
      }
    }
    onMediaSelect(null);
    onHandleGenerated(null);
  };

  const fileInput = (
    <input
      id="file-upload-input"
      type="file"
      className="hidden"
      onChange={handleFileChange}
      ref={fileInputRef}
      accept={
        mediaType === 'IMAGE'
          ? 'image/jpeg,image/png'
          : mediaType === 'VIDEO'
          ? 'video/mp4,video/3gpp'
          : mediaType === 'DOCUMENT'
          ? 'application/pdf'
          : undefined
      }
    />
  );

  if (uploading) {
    return (
      <Card className="p-4">
        <CardContent className="p-0 space-y-2">
          <p className="text-sm font-medium truncate">Enviando: {fileName}</p>
          <Progress value={progress} className="w-full h-2" />
          {progress < 100 && <p className="text-xs text-muted-foreground">Aguarde, processando ficheiro...</p>}
        </CardContent>
      </Card>
    );
  }

  if (selectedMedia) {
    return (
      <Card>
        <CardContent className="p-2 flex items-center gap-4">
          <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center shrink-0">
            <MediaIcon type={selectedMedia.type as HeaderType} />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold truncate" title={selectedMedia.name}>
              {selectedMedia.name}
            </p>
             <p className="text-xs text-muted-foreground">
                {(selectedMedia.fileSize / 1024).toFixed(2)} KB
            </p>
             {isGeneratingHandle && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Loader2 className="h-3 w-3 animate-spin"/>
                    <span>Processando com a Meta...</span>
                </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleRemoveMedia}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full border-2 border-dashed border-muted-foreground/50 rounded-lg p-6 text-center">
      {fileInput}
      <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        Anexe o arquivo de mídia para o cabeçalho.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button type="button" onClick={() => fileInputRef.current?.click()}>Fazer Upload</Button>
        <MediaLibraryDialog onSelectMedia={onMediaSelect} mediaType={mediaType}>
          <Button type="button" variant="outline">Selecionar da Biblioteca</Button>
        </MediaLibraryDialog>
      </div>
    </div>
  );
}
