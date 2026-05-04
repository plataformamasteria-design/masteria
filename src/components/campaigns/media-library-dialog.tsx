

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MediaAsset, HeaderType } from '@/lib/types';
import { File as FileIcon, Image as ImageIcon, Search, Loader2, Expand } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';

const MediaPreview = ({ media }: { media: MediaAsset }) => {
    if (media.type === 'IMAGE') {
        return <Image src={media.s3Url} alt={media.name} width={100} height={100} className="object-cover h-full w-full" data-ai-hint="product image" />;
    }
     if (media.type === 'VIDEO') {
        return <video src={media.s3Url} muted loop className="object-cover h-full w-full" />
    }
    const Icon = media.type === 'DOCUMENT' ? FileIcon : ImageIcon;
    return (
        <div className="h-full w-full flex items-center justify-center bg-muted">
            <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
    )
}

const MediaPreviewDialog = ({ media, open, onOpenChange }: { media: MediaAsset | null, open: boolean, onOpenChange: (open: boolean) => void }) => {
    if (!media) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{media.name}</DialogTitle>
                    <DialogDescription>Pré-visualização do ativo de mídia. Pressione ESC para fechar.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 min-h-0 bg-muted rounded-md flex items-center justify-center">
                    {media.type === 'IMAGE' ? (
                        <div className="relative w-full h-full">
                           <Image src={media.s3Url} alt={media.name} layout="fill" objectFit="contain" className="p-4" />
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

interface MediaLibraryDialogProps {
  children: React.ReactNode;
  mediaType: HeaderType | null | undefined;
  onSelectMedia: (media: MediaAsset) => void;
}

export function MediaLibraryDialog({ children, onSelectMedia, mediaType }: MediaLibraryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [mediaToPreview, setMediaToPreview] = useState<MediaAsset | null>(null);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  useEffect(() => {
    if (isOpen) {
        const fetchMedia = async () => {
            setLoading(true);
            try {
                let url = '/api/v1/media';
                if (mediaType && mediaType !== 'NONE') {
                    const params = new URLSearchParams({ type: mediaType });
                    url = `${url}?${params.toString()}`;
                }
                const res = await fetch(url);
                if (!res.ok) throw new Error('Falha ao carregar a galeria.');
                const data = await res.json();
                setMedia(data);
            } catch(error) {
                notify.error('Erro', (error as Error).message);
            } finally {
                setLoading(false);
            }
        }
        fetchMedia();
    }
  }, [isOpen, notify, mediaType]);

  const filteredMedia = media.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleSelect = (mediaAsset: MediaAsset) => {
    onSelectMedia(mediaAsset);
    setIsOpen(false);
  };
  
  const handlePreview = (mediaAsset: MediaAsset) => {
      setMediaToPreview(mediaAsset);
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-2xl h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Biblioteca de Mídia</DialogTitle>
            <DialogDescription>
              Selecione uma mídia existente para sua campanha. Apenas mídias do tipo <strong>{mediaType || 'qualquer'}</strong> são exibidas.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                  placeholder="Buscar mídia..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>
          <ScrollArea className="flex-grow">
              {loading ? (
                  <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
              ) : filteredMedia.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">Nenhuma mídia encontrada para este tipo.</div>
              ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-4">
                      {filteredMedia.map(item => (
                          <Card key={item.id} className="overflow-hidden group">
                              <CardContent className="p-0">
                                  <button type="button" onClick={() => handlePreview(item)} className="aspect-square bg-muted flex items-center justify-center overflow-hidden group relative">
                                     <MediaPreview media={item} />
                                     <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Expand className="h-8 w-8 text-white"/>
                                    </div>
                                  </button>
                                  <div className="p-2 space-y-2">
                                      <p className="text-xs font-medium truncate group-hover:text-primary">{item.name}</p>
                                      <Button size="sm" className="w-full" onClick={() => handleSelect(item)}>Selecionar</Button>
                                  </div>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MediaPreviewDialog media={mediaToPreview} open={!!mediaToPreview} onOpenChange={() => setMediaToPreview(null)} />
    </>
  );
}
