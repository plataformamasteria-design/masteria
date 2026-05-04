import { useState } from "react";
import { Play, Pin, PinOff, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Copy, Image, Music, Video, FileText, Download, Link2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { TestLeadSelector, type TestLead } from "./TestLeadSelector";

// Node types that require a lead for real test execution
const LEAD_REQUIRED_NODES = new Set([
  "send_message", "send_image", "send_audio", "send_document", "send_video",
  "send_ai_response", "ask_question", "wait_response", "capture_info", "follow_up_ai",
]);

interface NodeOutputPanelProps {
  nodeId: string;
  nodeLabel?: string;
  nodeType?: string;
  output: any;
  isPinned: boolean;
  isExecuting: boolean;
  error?: string | null;
  onExecute: (testLead?: TestLead) => void;
  onPin: () => void;
  onUnpin: () => void;
}

interface SchemaEntry {
  path: string;
  type: string;
  value: string;
  isMedia?: boolean;
  mediaCategory?: string;
  mediaUrl?: string;
  mediaBase64?: string;
}

function buildSchema(obj: any, path = ""): SchemaEntry[] {
  if (obj === null || obj === undefined) return [{ path, type: "null", value: String(obj) }];

  // Detect media object
  if (typeof obj === "object" && !Array.isArray(obj) && obj.__media) {
    return [{
      path: path || "media",
      type: "media",
      value: obj.url || obj.base64 || "",
      isMedia: true,
      mediaCategory: obj.category,
      mediaUrl: obj.url,
      mediaBase64: obj.base64,
    }];
  }

  if (Array.isArray(obj)) {
    const entries: SchemaEntry[] = [{ path: path || "root", type: `Array[${obj.length}]`, value: "" }];
    obj.forEach((item, i) => {
      entries.push(...buildSchema(item, `${path}[${i}]`));
    });
    return entries;
  }
  if (typeof obj === "object") {
    const entries: SchemaEntry[] = path ? [{ path, type: "Object", value: "" }] : [];
    Object.entries(obj).forEach(([key, val]) => {
      if (key === "__media") return; // skip marker
      const childPath = path ? `${path}.${key}` : key;
      entries.push(...buildSchema(val, childPath));
    });
    return entries;
  }
  return [{ path, type: typeof obj, value: String(obj) }];
}

const TYPE_COLORS: Record<string, string> = {
  string: "text-green-500",
  number: "text-blue-500",
  boolean: "text-amber-500",
  null: "text-muted-foreground",
  Object: "text-purple-500",
  media: "text-pink-500",
};

const MEDIA_ICONS: Record<string, typeof Image> = {
  image: Image,
  audio: Music,
  video: Video,
  document: FileText,
  file: FileText,
};

function MediaPreview({ entry, sourceName, nodeId }: { entry: SchemaEntry; sourceName: string; nodeId: string }) {
  const category = entry.mediaCategory || "file";
  const url = entry.mediaUrl || entry.mediaBase64 || "";
  const base64 = entry.mediaBase64 || "";
  const Icon = MEDIA_ICONS[category] || FileText;

  const handleDragStart = (e: React.DragEvent, field: string) => {
    const ref = `{{ ${sourceName}.$json.${field} }}`;
    e.dataTransfer.setData("text/plain", ref);
    e.dataTransfer.setData("application/x-node-output", JSON.stringify({
      nodeId,
      nodeLabel: sourceName,
      path: field,
      value: url,
      type: "media_url",
      ref,
    }));
    e.dataTransfer.effectAllowed = "copy";
  };

  const copyRef = (field: string) => {
    const ref = `{{ ${sourceName}.$json.${field} }}`;
    navigator.clipboard.writeText(ref);
    toast({ title: "Copiado!", description: ref });
  };

  return (
    <div className="space-y-2 p-1">
      {/* Preview */}
      <div className="rounded-lg border border-slate-200 dark:border-zinc-800/40 bg-muted/30 overflow-visible">
        {category === "image" && base64 && (
          <img src={base64} alt="Response media" className="w-full max-h-[180px] object-contain bg-black/5" />
        )}
        {category === "audio" && base64 && (
          <audio controls src={base64} className="w-full h-10" />
        )}
        {category === "video" && base64 && (
          <video controls src={base64} className="w-full max-h-[180px]" />
        )}
        {(category === "document" || category === "file") && (
          <div className="flex items-center gap-2 p-3">
            <Icon className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Arquivo recebido</span>
          </div>
        )}
      </div>

      {/* Draggable references */}
      <div className="space-y-0.5">
        <p className="text-[9px] text-muted-foreground font-semibold uppercase px-1">Referências (arraste)</p>

        {/* URL reference */}
        <div
          className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-accent/50 cursor-grab active:cursor-grabbing group/ref"
          draggable
          onDragStart={(e) => handleDragStart(e, "url")}
          onClick={() => copyRef("url")}
          title={`Arraste para usar: {{ ${sourceName}.$json.url }}`}
        >
          <Link2 className="h-3 w-3 text-blue-500 shrink-0" />
          <span className="text-[10px] font-semibold text-foreground">url</span>
          <span className="text-[9px] text-muted-foreground truncate flex-1 ml-1">
            {url.length > 50 ? url.slice(0, 50) + "…" : url}
          </span>
          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/ref:opacity-100 shrink-0" />
        </div>

        {/* Base64 reference */}
        <div
          className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-accent/50 cursor-grab active:cursor-grabbing group/ref"
          draggable
          onDragStart={(e) => handleDragStart(e, "base64")}
          onClick={() => copyRef("base64")}
          title={`Arraste para usar: {{ ${sourceName}.$json.base64 }}`}
        >
          <FileText className="h-3 w-3 text-green-500 shrink-0" />
          <span className="text-[10px] font-semibold text-foreground">base64</span>
          <span className="text-[9px] text-muted-foreground truncate flex-1 ml-1">data:{entry.value.split(";")[0]?.replace("data:", "")}</span>
          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/ref:opacity-100 shrink-0" />
        </div>

        {/* Content type */}
        <div
          className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-accent/50 cursor-grab active:cursor-grabbing group/ref"
          draggable
          onDragStart={(e) => handleDragStart(e, "content_type")}
          onClick={() => copyRef("content_type")}
        >
          <span className="text-[10px] font-mono text-pink-500">T</span>
          <span className="text-[10px] font-semibold text-foreground">content_type</span>
          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/ref:opacity-100 shrink-0" />
        </div>

        {/* File name */}
        <div
          className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-accent/50 cursor-grab active:cursor-grabbing group/ref"
          draggable
          onDragStart={(e) => handleDragStart(e, "file_name")}
          onClick={() => copyRef("file_name")}
        >
          <span className="text-[10px] font-mono text-pink-500">T</span>
          <span className="text-[10px] font-semibold text-foreground">file_name</span>
          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/ref:opacity-100 shrink-0" />
        </div>
      </div>

      {/* Download link */}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] text-primary hover:underline px-1"
        >
          <Download className="h-3 w-3" />
          Abrir / baixar arquivo
        </a>
      )}

      <div className="px-1">
        <span className="text-[8px] text-muted-foreground/60 italic">
          💡 Arraste url ou base64 para inputs de outros nós
        </span>
      </div>
    </div>
  );
}

function SchemaView({ data, nodeLabel, nodeId }: { data: any; nodeLabel?: string; nodeId: string }) {
  const schema = buildSchema(data);
  const sourceName = nodeLabel || nodeId;

  // Check if this is a media output
  const mediaEntry = schema.find((e) => e.isMedia);
  if (mediaEntry) {
    return <MediaPreview entry={mediaEntry} sourceName={sourceName} nodeId={nodeId} />;
  }

  const buildRef = (path: string) => `{{ ${sourceName}.$json.${path} }}`;

  const copyPath = (path: string) => {
    const ref = buildRef(path);
    navigator.clipboard.writeText(ref);
    toast({ title: "Copiado!", description: ref });
  };

  const handleDragStart = (e: React.DragEvent, entry: SchemaEntry) => {
    const ref = buildRef(entry.path);
    e.dataTransfer.setData("text/plain", ref);
    e.dataTransfer.setData("application/x-node-output", JSON.stringify({
      nodeId,
      nodeLabel: sourceName,
      path: entry.path,
      value: entry.value,
      type: entry.type,
      ref,
    }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="space-y-0.5">
      {((Array.isArray(schema) ? schema : []) || []).map((entry, i) => {
        const isLeaf = !["Object"].includes(entry.type) && !entry.type.startsWith("Array");
        const typeColor = TYPE_COLORS[entry.type] || "text-muted-foreground";
        const depth = (entry.path.match(/\./g) || []).length;

        return (
          <div
            key={i}
            className={`flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-accent/50 group/schema ${isLeaf ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            onClick={() => isLeaf && copyPath(entry.path)}
            draggable={isLeaf}
            onDragStart={(e) => isLeaf && handleDragStart(e, entry)}
            title={isLeaf ? `Arraste ou clique para copiar: ${buildRef(entry.path)}` : ""}
          >
            <span className={`text-[10px] font-mono ${typeColor}`}>
              {entry.type.startsWith("Array") ? "[]" : entry.type === "Object" ? "{}" : "T"}
            </span>
            <span className="text-[11px] font-semibold text-foreground truncate">
              {entry.path.split(".").pop() || entry.path}
            </span>
            {isLeaf && entry.value && (
              <span className="text-[10px] text-muted-foreground truncate ml-1 flex-1">
                {entry.value.length > 40 ? entry.value.slice(0, 40) + "..." : entry.value}
              </span>
            )}
            {isLeaf && (
              <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/schema:opacity-100 shrink-0" />
            )}
          </div>
        );
      })}
      <div className="mt-1 px-1">
        <span className="text-[8px] text-muted-foreground/60 italic">
          💡 Arraste campos para inputs de outros nós
        </span>
      </div>
    </div>
  );
}

export function NodeOutputPanel({ nodeId, nodeLabel, nodeType, output, isPinned, isExecuting, error, onExecute, onPin, onUnpin }: NodeOutputPanelProps) {
  const [showOutput, setShowOutput] = useState(!!output || !!error);
  const [testLead, setTestLead] = useState<TestLead | null>(null);
  const needsLead = nodeType ? LEAD_REQUIRED_NODES.has(nodeType) : false;

  const isMedia = output && typeof output === "object" && output.__media;
  const jsonString = output ? JSON.stringify(output, null, 2) : "";

  const copyJson = () => {
    navigator.clipboard.writeText(jsonString);
    toast({ title: "JSON copiado!" });
  };

  return (
    <div className="border-t border-slate-200 dark:border-zinc-800/40">
      {/* Test Lead Selector for nodes that need a lead */}
      {needsLead && (
        <div className="px-3 py-2 space-y-1.5 border-b border-slate-200 dark:border-zinc-800/30 nodrag nowheel">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Teste Real</span>
          </div>
          <TestLeadSelector value={testLead} onChange={setTestLead} />
          {testLead && (
            <Button
              size="sm"
              className="w-full h-7 text-[10px] gap-1.5"
              onClick={() => onExecute(testLead)}
              disabled={isExecuting}
            >
              {isExecuting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Executar teste com {testLead.name}
            </Button>
          )}
        </div>
      )}

      {(output || error) && (
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent/30 transition-colors nodrag"
          onClick={() => setShowOutput(!showOutput)}
        >
          {showOutput ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="text-[10px] font-semibold text-muted-foreground uppercase flex-1 text-left">
            {isMedia ? "Mídia" : "Output"}
          </span>
          {nodeLabel && (
            <span className="text-[8px] text-primary/60 font-mono truncate max-w-[80px]">{nodeLabel}</span>
          )}
          {error ? (
            <XCircle className="h-3 w-3 text-destructive" />
          ) : isMedia ? (
            <Image className="h-3 w-3 text-pink-500" />
          ) : output ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              isPinned ? onUnpin() : onPin();
            }}
            title={isPinned ? "Desafixar output" : "Fixar output"}
          >
            {isPinned ? <PinOff className="h-3 w-3 text-primary" /> : <Pin className="h-3 w-3 text-muted-foreground" />}
          </Button>
        </button>
      )}

      {showOutput && (output || error) && (
        <div className="px-3 pb-3 nowheel nodrag">
          {error ? (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2">
              <p className="text-[10px] text-destructive">{error}</p>
            </div>
          ) : output ? (
            <Tabs defaultValue="schema" className="w-full">
              <div className="flex items-center justify-between mb-1">
                <TabsList className="h-6 p-0.5">
                  <TabsTrigger value="schema" className="text-[10px] h-5 px-2">
                    {isMedia ? "Preview" : "Schema"}
                  </TabsTrigger>
                  <TabsTrigger value="json" className="text-[10px] h-5 px-2">JSON</TabsTrigger>
                </TabsList>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyJson} title="Copiar JSON">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <TabsContent value="schema" className="mt-0 max-h-[280px] overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-800/40 bg-muted/30 p-1">
                <SchemaView data={output} nodeLabel={nodeLabel} nodeId={nodeId} />
              </TabsContent>
              <TabsContent value="json" className="mt-0 max-h-[200px] overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-800/40 bg-zinc-950 p-2">
                <pre className="text-[10px] font-mono text-zinc-300 whitespace-pre-wrap break-all">
                  {isMedia
                    ? JSON.stringify({ ...output, base64: `[${(output.base64 || "").length} chars]` }, null, 2)
                    : jsonString
                  }
                </pre>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      )}

      {isPinned && !showOutput && (
        <div className="px-3 pb-1 flex items-center gap-1">
          <Pin className="h-2.5 w-2.5 text-primary" />
          <span className="text-[9px] text-primary font-medium">Output fixado</span>
        </div>
      )}
    </div>
  );
}

export function NodeExecuteButton({ onExecute, isExecuting }: { onExecute: () => void; isExecuting: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-muted-foreground hover:text-emerald-500"
      onClick={(e) => {
        e.stopPropagation();
        onExecute();
      }}
      disabled={isExecuting}
      title="Executar nó"
    >
      {isExecuting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
    </Button>
  );
}

// Helper for drop target inputs - shows preview of dropped value
export function DroppableInput({
  value,
  onChange,
  placeholder,
  className,
  droppedMeta,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  droppedMeta?: { nodeLabel: string; value: string } | null;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const outputData = e.dataTransfer.getData("application/x-node-output");
    if (outputData) {
      try {
        const parsed = JSON.parse(outputData);
        onChange(parsed.ref);
        return;
      } catch {}
    }
    const text = e.dataTransfer.getData("text/plain");
    if (text) onChange(text);
  };

  const variableMatch = value.match(/\{\{\s*(.+?)\.\$json\.(.+?)\s*\}\}/);

  return (
    <div className="space-y-0.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${className || ""} ${isDragOver ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      />
      {variableMatch && (
        <div className="flex items-center gap-1 px-1">
          <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-violet-500/10 text-violet-600 truncate">
            ← {variableMatch[1]}
          </span>
          {droppedMeta?.value && (
            <span className="text-[8px] text-muted-foreground truncate">
              = {droppedMeta.value.length > 30 ? droppedMeta.value.slice(0, 30) + "..." : droppedMeta.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
