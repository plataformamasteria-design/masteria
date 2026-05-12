import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  FolderOpen, Upload, Download, Trash2, FileText, ImageIcon,
  Mic, Video, File, Package
} from "lucide-react";
import { format } from "date-fns";

interface LeadFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  source: string;
  created_at: string;
}

interface LeadFolderProps {
  chatId: string;
}

export function LeadFolder({ chatId }: LeadFolderProps) {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LeadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = async () => {
    if (!chatId || !currentOrganization?.id) return;
    const { data } = await (supabase as any)
      .from("lead_files")
      .select("*")
      .eq("chat_id", chatId)
      .eq("organization_id", currentOrganization.id)
      .order("created_at", { ascending: false });
    setFiles(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, [chatId, currentOrganization?.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !currentOrganization?.id) return;
    setUploading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      for (const file of Array.from(selectedFiles)) {
        const { uploadFileWithFallback } = await import("@/lib/r2Upload");
        const publicUrl = await uploadFileWithFallback(file, `lead-files/${currentOrganization.id}/${chatId}`, file.name);

        await (supabase as any).from("lead_files").insert({
          chat_id: chatId,
          organization_id: currentOrganization.id,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type || null,
          source: "upload",
          uploaded_by: userData.user?.id,
        });
      }

      toast({ title: "Arquivo(s) adicionado(s) à pasta!" });
      fetchFiles();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao enviar", description: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fileId: string) => {
    await (supabase as any).from("lead_files").delete().eq("id", fileId);
    toast({ title: "Arquivo removido" });
    fetchFiles();
  };

  const handleDownload = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleDownloadAll = async () => {
    if (files.length === 0) return;
    toast({ title: "Iniciando download...", description: `${files.length} arquivo(s)` });

    // Download files individually (zip requires a library)
    for (const file of files) {
      await handleDownload(file.file_url, file.file_name);
      // Small delay between downloads
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File className="h-4 w-4 text-muted-foreground" />;
    if (type.startsWith("image")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
    if (type.startsWith("audio")) return <Mic className="h-4 w-4 text-green-500" />;
    if (type.startsWith("video")) return <Video className="h-4 w-4 text-purple-500" />;
    if (type.includes("pdf")) return <FileText className="h-4 w-4 text-destructive" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3 w-3" />
            {uploading ? "Enviando..." : "Anexar"}
          </Button>
          {files.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleDownloadAll}
            >
              <Package className="h-3 w-3" />
              Baixar todos
            </Button>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{files.length} arquivo(s)</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-3">Carregando...</p>
      ) : files.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Pasta vazia</p>
        </div>
      ) : (
        <ScrollArea className="max-h-48">
          <div className="space-y-1.5">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                {getFileIcon(file.file_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{file.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {file.file_size ? `${(file.file_size / 1024).toFixed(0)} KB · ` : ""}
                    {format(new Date(file.created_at), "dd/MM/yy HH:mm")}
                    {file.source === "chat" && " · do chat"}
                  </p>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDownload(file.file_url, file.file_name)}
                    className="p-1.5 rounded hover:bg-background transition-colors"
                    title="Baixar"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
