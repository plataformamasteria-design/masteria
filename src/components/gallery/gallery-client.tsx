// src/components/gallery/gallery-client.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Trash2, Video, Image as ImageIcon, FileText, Expand } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from '@/components/ui/alert-dialog';
import Image from 'next/image';
import type { MediaAsset } from '@/lib/types';
import { UploadMediaDialog } from './upload-media-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

const MediaIcon = ({ type }: { type: MediaAsset['type']}): React.ReactElement | null => {
    switch (type) {
        case 'IMAGE': return <ImageIcon className="h-8 w-8 text-muted-foreground" />;
        case 'VIDEO': return <Video className="h-8 w-8 text-muted-foreground" />;
        case 'DOCUMENT': return <FileText className="h-8 w-8 text-muted-foreground" />;
        default: return null;
    }
}

const MediaPreviewDialog = ({ media, open, onOpenChange }: { media: MediaAsset | null, open: boolean, onOpenChange: (open: boolean) => void }): React.ReactElement | null => {
    if (!media) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{media.name}</DialogTitle>
                    <DialogDescription>Pré-visualização do ficheiro de mídia. Pressione ESC para fechar.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 bg-muted rounded-md flex items-center justify-center">
                    {media.type === 'IMAGE' ? (
                        <div className="relative w-full h-full">
                           <Image src={media.s3Url} alt={media.name} fill unoptimized className="object-contain p-4" />
                        </div>
                    ) : media.type === 'VIDEO' ? (
                        <video src={media.s3Url} controls className="max-h-full max-w-full">
                            Your browser does not support the video tag.
                        </video>
                    ) : media.type === 'DOCUMENT' ? (
                        <iframe src={media.s3Url} className="w-full h-full" title={media.name} />
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}

const MediaCard = ({ media, onDelete, onPreview }: { media: MediaAsset, onDelete: (id: string) => void, onPreview: (media: MediaAsset) => void }): React.ReactElement => {

    return (
        <Card className="flex flex-col">
            <CardContent className="p-0 flex-1 flex flex-col">
                <button type="button" onClick={(): void => onPreview(media)} className="aspect-square bg-muted flex items-center justify-center overflow-hidden group relative">
                    {media.type === 'IMAGE' ? (
                        <Image src={media.s3Url} alt={media.name} width={200} height={200} unoptimized className="object-cover h-full w-full"/>
                    ) : media.type === 'VIDEO' ? (
                        <video src={media.s3Url} muted loop className="object-cover h-full w-full" />
                    ): (
                        <MediaIcon type={media.type} />
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Expand className="h-8 w-8 text-white"/>
                    </div>
                </button>
                 <div className="p-3 space-y-2 flex flex-col flex-1">
                    <p className="text-sm font-medium truncate flex-1" title={media.name}>{media.name}</p>
                    <div className="space-y-1">
                         {/* This section can be used later to show WABA specific handles */}
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="w-full">
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Mídia?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Tem a certeza que deseja excluir o ficheiro &quot;{media.name}&quot;? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={(): void => onDelete(media.id)}>Sim, Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 </div>
            </CardContent>
        </Card>
    )
}


export function GalleryClient(): React.ReactElement {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaToPreview, setMediaToPreview] = useState<MediaAsset | null>(null);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const fetchMedia = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
        const res = await fetch('/api/v1/media');
        if (!res.ok) throw new Error('Falha ao carregar a galeria.');
        const data = await res.json() as MediaAsset[];
        setMedia(data);
    } catch(error) {
        notify.error('Erro', (error as Error).message);
    } finally {
        setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void fetchMedia();
  }, [fetchMedia]);

  const handleDelete = async (id: string): Promise<void> => {
    try {
        const response = await fetch(`/api/v1/media/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Falha ao excluir a mídia.');
        notify.success('Mídia Excluída!', 'O ficheiro foi removido com sucesso.');
        void fetchMedia(); // Refresh
    } catch (error) {
        notify.error('Erro', (error as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Galeria de Mídia"
        description="Gerencie as imagens, vídeos e documentos para as suas campanhas."
      >
        <UploadMediaDialog onUploadComplete={fetchMedia}>
             <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Fazer Upload
            </Button>
        </UploadMediaDialog>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : media.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-semibold">Galeria Vazia</h3>
            <p>Comece por fazer o upload do seu primeiro ficheiro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {media.map(item => <MediaCard key={item.id} media={item} onDelete={handleDelete} onPreview={setMediaToPreview} />)}
        </div>
      )}
      <MediaPreviewDialog media={mediaToPreview} open={!!mediaToPreview} onOpenChange={(): void => setMediaToPreview(null)} />
    </>
  );
}
