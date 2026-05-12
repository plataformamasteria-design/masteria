import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageIcon, Mic, FileText, Video, Download, ZoomIn, Play } from "lucide-react";
import { ImageLightbox } from "@/components/chat/ImageLightbox";
import { AudioPlayer } from "@/components/chat/AudioPlayer";
import { format } from "date-fns";

interface MediaItem {
  id: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  message_type: string;
  created_at: string;
  content: string | null;
}

interface LeadMediaGalleryProps {
  chatId: string;
}

export function LeadMediaGallery({ chatId }: LeadMediaGalleryProps) {
  const { currentOrganization } = useOrganization();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId || !currentOrganization?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("messages")
        .select("id, file_url, file_name, file_size, message_type, created_at, content")
        .eq("chat_id", chatId)
        .eq("organization_id", currentOrganization.id)
        .in("message_type", ["image", "audio", "video", "pdf", "document"])
        .not("file_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      setMedia(data || []);
      setLoading(false);
    })();
  }, [chatId, currentOrganization?.id]);

  const images = media.filter(m => m.message_type === "image");
  const audios = media.filter(m => m.message_type === "audio");
  const videos = media.filter(m => m.message_type === "video");
  const docs = media.filter(m => m.message_type === "pdf" || m.message_type === "document");

  const handleDownload = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name || "arquivo";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  if (loading) {
    return <div className="text-xs text-muted-foreground text-center py-4">Carregando mídias...</div>;
  }

  if (media.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        Nenhuma mídia compartilhada
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Tabs defaultValue="images" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-8">
          <TabsTrigger value="images" className="text-xs gap-1 px-1">
            <ImageIcon className="h-3 w-3" />
            {images.length}
          </TabsTrigger>
          <TabsTrigger value="videos" className="text-xs gap-1 px-1">
            <Video className="h-3 w-3" />
            {videos.length}
          </TabsTrigger>
          <TabsTrigger value="audios" className="text-xs gap-1 px-1">
            <Mic className="h-3 w-3" />
            {audios.length}
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-xs gap-1 px-1">
            <FileText className="h-3 w-3" />
            {docs.length}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="mt-2">
          <ScrollArea className="max-h-48">
            <div className="grid grid-cols-4 gap-1.5">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square rounded-md overflow-hidden cursor-pointer group bg-muted"
                  onClick={() => setLightboxSrc(img.file_url)}
                >
                  <img
                    src={img.file_url}
                    alt={img.file_name || ""}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-5 w-5 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="videos" className="mt-2">
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {videos.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum vídeo</p>}
              {videos.map((v) => (
                <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="h-10 w-10 rounded bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Play className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{v.file_name || "Vídeo"}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(v.created_at), "dd/MM/yy HH:mm")}</p>
                  </div>
                  <button onClick={() => handleDownload(v.file_url, v.file_name || "video")} className="p-1.5 rounded hover:bg-background transition-colors">
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="audios" className="mt-2">
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {audios.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum áudio</p>}
              {audios.map((a) => (
                <div key={a.id} className="p-2 rounded-lg bg-muted/50">
                  <AudioPlayer src={a.file_url} isFromUser={false} />
                  <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.created_at), "dd/MM/yy HH:mm")}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="docs" className="mt-2">
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {docs.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum documento</p>}
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <FileText className="h-8 w-8 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{d.file_name || "Documento"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.file_size ? `${(d.file_size / 1024 / 1024).toFixed(1)} MB · ` : ""}
                      {format(new Date(d.created_at), "dd/MM/yy HH:mm")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => window.open(d.file_url, "_blank")} className="p-1.5 rounded hover:bg-background transition-colors" title="Abrir">
                      <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDownload(d.file_url, d.file_name || "documento")} className="p-1.5 rounded hover:bg-background transition-colors" title="Baixar">
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="Mídia"
          isOpen={!!lightboxSrc}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}
