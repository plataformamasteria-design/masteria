import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Image, Mic, FileText, Upload, X, File, Video, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MEDIA_CONFIG: Record<string, { icon: any; label: string; color: string; accept: string }> = {
  send_image: { icon: Image, label: "Enviar Imagem", color: "emerald", accept: "image/*" },
  send_audio: { icon: Mic, label: "Enviar Áudio", color: "violet", accept: "audio/*" },
  send_document: { icon: FileText, label: "Enviar Documento", color: "amber", accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" },
  send_video: { icon: Video, label: "Enviar Vídeo", color: "sky", accept: "video/*" },
};

function SendMediaNodeComponent({ id, data, type }: NodeProps) {
  const nodeType = (type as string) || "send_image";
  const mediaConfig = MEDIA_CONFIG[nodeType] || MEDIA_CONFIG.send_image;
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [fileUrl, setFileUrl] = useState(config.file_url || "");
  const [fileName, setFileName] = useState(config.file_name || "");
  const [stringSource, setStringSource] = useState(config.string_source || "");
  const [sourceMode, setSourceMode] = useState<string>(config.source_mode || "attachment");
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setFileUrl(config.file_url || ""); }, [config.file_url]);
  useEffect(() => { setFileName(config.file_name || ""); }, [config.file_name]);
  useEffect(() => { setStringSource(config.string_source || ""); }, [config.string_source]);
  useEffect(() => { setSourceMode(config.source_mode || "attachment"); }, [config.source_mode]);

  const updateConfig = (updates: any) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } }); };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => { const dataUrl = reader.result as string; setFileUrl(dataUrl); setFileName(file.name); updateConfig({ file_url: dataUrl, file_name: file.name, file_mime: file.type, source_mode: "attachment" }); setUploading(false); };
      reader.onerror = () => { setUploading(false); };
      reader.readAsDataURL(file);
    } catch { setUploading(false); }
  };

  const clearFile = () => { setFileUrl(""); setFileName(""); updateConfig({ file_url: "", file_name: "", file_mime: "" }); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const handleModeChange = (mode: string) => {
    setSourceMode(mode);
    updateConfig({ source_mode: mode });
  };

  const handleStringSourceChange = (val: string) => {
    setStringSource(val);
    updateConfig({ string_source: val, source_mode: "string" });
  };

  const handleStringDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const outputData = e.dataTransfer.getData("application/x-node-output");
    if (outputData) {
      try {
        const parsed = JSON.parse(outputData);
        handleStringSourceChange(parsed.ref);
        return;
      } catch {}
    }
    const text = e.dataTransfer.getData("text/plain");
    if (text) handleStringSourceChange(text);
  };

  const variableMatch = stringSource.match(/\{\{\s*(.+?)\.\$json\.(.+?)\s*\}\}/);

  const Icon = mediaConfig.icon;
  const colorClass = `text-${mediaConfig.color}-500`;
  const bgClass = `bg-${mediaConfig.color}-500/10`;

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[260px] max-w-[300px] overflow-visible group">
      <Handle type="target" position={Position.Top} className={`!w-4 !h-4 !bg-${mediaConfig.color}-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125`} />
      <NodeHeader nodeId={id} icon={<Icon className={`h-4 w-4 ${colorClass}`} />} defaultLabel={mediaConfig.label} customLabel={customLabel} colorClass={bgClass} textColorClass={colorClass} onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-2">
        {/* Mode tabs */}
        <Tabs value={sourceMode} onValueChange={handleModeChange} className="w-full">
          <TabsList className="h-7 w-full p-0.5">
            <TabsTrigger value="attachment" className="text-[10px] h-6 flex-1 gap-1">
              <Upload className="h-3 w-3" />Anexo
            </TabsTrigger>
            <TabsTrigger value="string" className="text-[10px] h-6 flex-1 gap-1">
              <Link2 className="h-3 w-3" />URL / Base64
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attachment" className="mt-2 space-y-2">
            <input ref={fileInputRef} type="file" accept={mediaConfig.accept} className="hidden" onChange={handleFileSelect} />
            {/* Image preview */}
            {nodeType === "send_image" && fileUrl && (
              <div className="relative rounded-lg overflow-visible border border-slate-200 dark:border-zinc-800 bg-muted">
                <img src={fileUrl} alt="Preview" className="w-full h-28 object-cover" />
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-5 w-5 bg-background/80 hover:bg-background text-destructive" onClick={clearFile}><X className="h-3 w-3" /></Button>
              </div>
            )}
            {/* Audio preview */}
            {nodeType === "send_audio" && fileUrl && (
              <div className="relative rounded-lg border border-slate-200 dark:border-zinc-800 bg-muted p-2 space-y-1.5">
                <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground truncate flex-1">{fileName || "Áudio"}</span><Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-destructive" onClick={clearFile}><X className="h-3 w-3" /></Button></div>
                <audio controls className="w-full h-8 nodrag" style={{ minWidth: 0 }}><source src={fileUrl} /></audio>
              </div>
            )}
            {/* Document preview */}
            {nodeType === "send_document" && fileUrl && (
              <div className="relative flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-muted">
                <File className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-[10px] text-muted-foreground truncate flex-1">{fileName || "Documento"}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-destructive" onClick={clearFile}><X className="h-3 w-3" /></Button>
              </div>
            )}
            {/* Video preview */}
            {nodeType === "send_video" && fileUrl && (
              <div className="relative rounded-lg overflow-visible border border-slate-200 dark:border-zinc-800 bg-muted">
                <video src={fileUrl} controls className="w-full h-28 object-cover nodrag" />
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-5 w-5 bg-background/80 hover:bg-background text-destructive" onClick={clearFile}><X className="h-3 w-3" /></Button>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 nodrag" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-3 w-3" />{uploading ? "Enviando..." : fileUrl ? "Trocar arquivo" : "Anexar arquivo"}
            </Button>
          </TabsContent>

          <TabsContent value="string" className="mt-2 space-y-1.5">
            <p className="text-[9px] text-muted-foreground">Cole uma URL, base64 ou arraste um output de outro nó:</p>
            <textarea
              value={stringSource}
              onChange={(e) => handleStringSourceChange(e.target.value)}
              placeholder="https://... ou data:image/png;base64,... ou {{ Node.$json.url }}"
              className={`w-full text-[11px] rounded-md border bg-background px-2 py-1.5 min-h-[56px] resize-none nodrag placeholder:text-muted-foreground/50 transition-all ${isDragOver ? "ring-2 ring-primary/50 bg-primary/5 border-primary" : "border-slate-200 dark:border-zinc-800/50"}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleStringDrop}
            />
            {variableMatch && (
              <div className="flex items-center gap-1 px-1">
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 truncate">
                  ← {variableMatch[1]}.{variableMatch[2]}
                </span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || mediaConfig.label} nodeType={nodeType} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={(testLead) => (data as any)?.onExecute?.(id, testLead)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className={`!w-4 !h-4 !bg-${mediaConfig.color}-500 !border-[3px] !border-white dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125`} />
    </div>
  );
}

export const SendImageNode = memo(SendMediaNodeComponent);
export const SendAudioNode = memo(SendMediaNodeComponent);
export const SendDocumentNode = memo(SendMediaNodeComponent);
export const SendVideoNode = memo(SendMediaNodeComponent);
