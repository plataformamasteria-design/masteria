import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Globe, Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const AUTH_TYPES = [
  { value: "none", label: "Nenhuma" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "api_key", label: "API Key" },
] as const;

interface KeyValuePair { id: string; name: string; value: string; }
function newPair(): KeyValuePair { return { id: crypto.randomUUID(), name: "", value: "" }; }

function HttpRequestNodeComponent({ id, data }: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const config = (data as any)?.config || {};
  const onChange = (data as any)?.onChange;
  const customLabel = (data as any)?.label || "";

  const method = config.method || "GET";
  const url = config.url || "";
  const authType = config.auth_type || "none";
  const authConfig = config.auth_config || {};
  const sendHeaders = config.send_headers ?? false;
  const headersMode = config.headers_mode || "fields";
  const headers: KeyValuePair[] = config.headers || [];
  const headersJson = config.headers_json || "{}";
  const sendQueryParams = config.send_query_params ?? false;
  const queryParamsMode = config.query_params_mode || "fields";
  const queryParams: KeyValuePair[] = config.query_params || [];
  const queryParamsJson = config.query_params_json || "{}";
  const sendBody = config.send_body ?? false;
  const bodyMode = config.body_mode || "fields";
  const bodyFields: KeyValuePair[] = config.body_fields || [];
  const bodyJson = config.body_json || "{}";
  const bodyContentType = config.body_content_type || "json";

  const updateConfig = (patch: Record<string, any>) => {
    if (!onChange) return;
    onChange(id, { config: { ...config, ...patch } });
  };

  const updatePairs = (key: string, pairs: KeyValuePair[]) => updateConfig({ [key]: pairs });
  const addPair = (key: string, current: KeyValuePair[]) => updatePairs(key, [...current, newPair()]);
  const removePair = (key: string, current: KeyValuePair[], pairId: string) => updatePairs(key, current.filter((p) => p.id !== pairId));
  const updatePair = (key: string, current: KeyValuePair[], pairId: string, field: "name" | "value", val: string) =>
    updatePairs(key, ((Array.isArray(current) ? current : []) || []).map((p) => (p.id === pairId ? { ...p, [field]: val } : p)));

  const handleDropOnInput = (e: React.DragEvent, pairsKey: string, pairs: KeyValuePair[], pairId: string, field: "name" | "value") => {
    e.preventDefault();
    const outputData = e.dataTransfer.getData("application/x-node-output");
    if (outputData) {
      try {
        const parsed = JSON.parse(outputData);
        updatePair(pairsKey, pairs, pairId, field, parsed.ref);
        return;
      } catch {}
    }
    const text = e.dataTransfer.getData("text/plain");
    if (text) updatePair(pairsKey, pairs, pairId, field, text);
  };

  const renderFieldsOrJson = (
    label: string, pairs: KeyValuePair[], pairsKey: string,
    jsonValue: string, jsonKey: string, mode: string, modeKey: string
  ) => (
    <div className="space-y-2">
      <Tabs value={mode} onValueChange={(v) => updateConfig({ [modeKey]: v })}>
        <TabsList className="h-7 p-0.5">
          <TabsTrigger value="fields" className="text-[10px] h-6 px-2">Fields</TabsTrigger>
          <TabsTrigger value="json" className="text-[10px] h-6 px-2">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="fields" className="mt-1.5 space-y-1.5">
          {((Array.isArray(pairs) ? pairs : []) || []).map((pair) => (
            <div key={pair.id} className="flex gap-1 items-center">
              <Input placeholder="Name" value={pair.name}
                onChange={(e) => updatePair(pairsKey, pairs, pair.id, "name", e.target.value)}
                onDrop={(e) => handleDropOnInput(e, pairsKey, pairs, pair.id, "name")}
                onDragOver={(e) => e.preventDefault()}
                className="h-7 text-[11px] flex-1 nodrag" />
              <Input placeholder="Value" value={pair.value}
                onChange={(e) => updatePair(pairsKey, pairs, pair.id, "value", e.target.value)}
                onDrop={(e) => handleDropOnInput(e, pairsKey, pairs, pair.id, "value")}
                onDragOver={(e) => e.preventDefault()}
                className="h-7 text-[11px] flex-1 nodrag" />
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removePair(pairsKey, pairs, pair.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => addPair(pairsKey, pairs)}>
            <Plus className="h-3 w-3 mr-1" />Adicionar {label}
          </Button>
        </TabsContent>
        <TabsContent value="json" className="mt-1.5">
          <Textarea value={jsonValue} onChange={(e) => updateConfig({ [jsonKey]: e.target.value })}
            className="text-[11px] font-mono min-h-[60px] nodrag nowheel" placeholder={`{\n  "key": "value"\n}`} />
        </TabsContent>
      </Tabs>
    </div>
  );

  const methodColor: Record<string, string> = {
    GET: "text-green-500", POST: "text-yellow-500", PUT: "text-blue-500",
    PATCH: "text-orange-500", DELETE: "text-red-500", HEAD: "text-purple-500", OPTIONS: "text-gray-500 dark:text-zinc-400",
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border-2 border-orange-500/60 rounded-xl shadow-lg min-w-[260px] max-w-[340px] overflow-visible">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-orange-50 dark:bg-orange-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader
        nodeId={id}
        icon={<Globe className="h-4 w-4 text-zinc-900 dark:text-white" />}
        defaultLabel="HTTP Request"
        customLabel={customLabel}
        colorClass="bg-orange-50 dark:bg-orange-900/300"
        textColorClass="text-zinc-900 dark:text-white"
        solidHeader
        showOnHover={false}
        onExecute={() => (data as any)?.onExecute?.(id)}
        isExecuting={(data as any)?.isExecuting}
        onDuplicate={() => (data as any)?.onDuplicate?.(id)}
        onDelete={() => (data as any)?.onDelete?.(id)}
        onRename={(label) => (data as any)?.onRename?.(id, label)}
      />

      <button className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-accent/30 transition-colors nodrag"
        onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className={`text-[11px] font-bold ${methodColor[method] || ""}`}>{method}</span>
        <span className="text-[11px] text-muted-foreground truncate flex-1">{url || "Configurar URL..."}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-200 dark:border-zinc-800/40 pt-3 max-h-[500px] overflow-y-auto nowheel nodrag">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Method</Label>
            <Select value={method} onValueChange={(v) => updateConfig({ method: v })}>
              <SelectTrigger className="h-7 text-[11px] nodrag"><SelectValue /></SelectTrigger>
              <SelectContent>{((Array.isArray(METHODS) ? METHODS : []) || []).map((m) => (<SelectItem key={m} value={m} className="text-[11px]"><span className={methodColor[m]}>{m}</span></SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">URL</Label>
            <Input value={url} onChange={(e) => updateConfig({ url: e.target.value })} placeholder="https://api.example.com/endpoint" className="h-7 text-[11px] font-mono nodrag" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Authentication</Label>
            <Select value={authType} onValueChange={(v) => updateConfig({ auth_type: v, auth_config: {} })}>
              <SelectTrigger className="h-7 text-[11px] nodrag"><SelectValue /></SelectTrigger>
              <SelectContent>{((Array.isArray(AUTH_TYPES) ? AUTH_TYPES : []) || []).map((a) => (<SelectItem key={a.value} value={a.value} className="text-[11px]">{a.label}</SelectItem>))}</SelectContent>
            </Select>
            {authType === "bearer" && <Input value={authConfig.token || ""} onChange={(e) => updateConfig({ auth_config: { ...authConfig, token: e.target.value } })} placeholder="Token" className="h-7 text-[11px] font-mono nodrag" />}
            {authType === "basic" && (<div className="space-y-1"><Input value={authConfig.username || ""} onChange={(e) => updateConfig({ auth_config: { ...authConfig, username: e.target.value } })} placeholder="Username" className="h-7 text-[11px] nodrag" /><Input type="password" value={authConfig.password || ""} onChange={(e) => updateConfig({ auth_config: { ...authConfig, password: e.target.value } })} placeholder="Password" className="h-7 text-[11px] nodrag" /></div>)}
            {authType === "api_key" && (<div className="space-y-1"><Input value={authConfig.header_name || ""} onChange={(e) => updateConfig({ auth_config: { ...authConfig, header_name: e.target.value } })} placeholder="Header Name (ex: x-api-key)" className="h-7 text-[11px] nodrag" /><Input value={authConfig.prefix || ""} onChange={(e) => updateConfig({ auth_config: { ...authConfig, prefix: e.target.value } })} placeholder="Prefix (ex: Bearer)" className="h-7 text-[11px] nodrag" /><Input value={authConfig.key || ""} onChange={(e) => updateConfig({ auth_config: { ...authConfig, key: e.target.value } })} placeholder="API Key" className="h-7 text-[11px] font-mono nodrag" /></div>)}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><Label className="text-[10px] font-semibold text-muted-foreground uppercase">Send Query Parameters</Label><Switch checked={sendQueryParams} onCheckedChange={(v) => updateConfig({ send_query_params: v })} className="scale-75 nodrag" /></div>
            {sendQueryParams && renderFieldsOrJson("Param", queryParams, "query_params", queryParamsJson, "query_params_json", queryParamsMode, "query_params_mode")}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><Label className="text-[10px] font-semibold text-muted-foreground uppercase">Send Headers</Label><Switch checked={sendHeaders} onCheckedChange={(v) => updateConfig({ send_headers: v })} className="scale-75 nodrag" /></div>
            {sendHeaders && renderFieldsOrJson("Header", headers, "headers", headersJson, "headers_json", headersMode, "headers_mode")}
          </div>
          {method !== "GET" && method !== "HEAD" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between"><Label className="text-[10px] font-semibold text-muted-foreground uppercase">Send Body</Label><Switch checked={sendBody} onCheckedChange={(v) => updateConfig({ send_body: v })} className="scale-75 nodrag" /></div>
              {sendBody && (
                <div className="space-y-2">
                  <Select value={bodyContentType} onValueChange={(v) => updateConfig({ body_content_type: v })}>
                    <SelectTrigger className="h-7 text-[11px] nodrag"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="json" className="text-[11px]">JSON</SelectItem><SelectItem value="form" className="text-[11px]">Form URL Encoded</SelectItem><SelectItem value="multipart" className="text-[11px]">Multipart Form</SelectItem><SelectItem value="raw" className="text-[11px]">Raw</SelectItem></SelectContent>
                  </Select>
                  {bodyContentType === "raw" ? (
                    <Textarea value={bodyJson} onChange={(e) => updateConfig({ body_json: e.target.value })} className="text-[11px] font-mono min-h-[60px] nodrag nowheel" placeholder="Raw body content..." />
                  ) : renderFieldsOrJson("Campo", bodyFields, "body_fields", bodyJson, "body_json", bodyMode, "body_mode")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "HTTP Request"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-orange-50 dark:bg-orange-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const HttpRequestNode = memo(HttpRequestNodeComponent);
