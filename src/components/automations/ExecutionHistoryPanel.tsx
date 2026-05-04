import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { History, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronRight, User, Copy, Check, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ExecutionLog {
  id: string;
  node_id: string;
  status: string;
  message: string | null;
  created_at: string;
}

interface Execution {
  id: string;
  status: string;
  chat_id: string;
  created_at: string;
  completed_at: string | null;
  context: any;
  logs: ExecutionLog[];
  chatName?: string;
}

interface ExecutionHistoryPanelProps {
  automationId: string;
  nodes: Array<{ id: string; type?: string; data?: any }>;
  onHighlightNodes?: (nodeIds: string[]) => void;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Concluído" },
  failed: { icon: XCircle, color: "text-destructive", label: "Falhou" },
  running: { icon: Loader2, color: "text-blue-500", label: "Executando" },
  waiting: { icon: Clock, color: "text-amber-500", label: "Aguardando" },
  waiting_response: { icon: Clock, color: "text-amber-500", label: "Aguardando resposta" },
};

function parseTokensFromMessage(message: string | null): { cleanMessage: string; tokens: { prompt: number; completion: number; total: number } | null; humanizeBreakdown: string | null } {
  if (!message) return { cleanMessage: "", tokens: null, humanizeBreakdown: null };

  // Extract humanize breakdown if present (e.g. "Geração: 7108 + Humanização: 281 = 7389 tokens")
  const humanizeMatch = message.match(/\| Geração: (\d+) \+ Humanização: (\d+) = (\d+) tokens/);
  let humanizeBreakdown: string | null = null;
  if (humanizeMatch) {
    humanizeBreakdown = `Geração: ${humanizeMatch[1]} + Humanização: ${humanizeMatch[2]} = ${humanizeMatch[3]}`;
  }

  const tokenMatch = message.match(/\| Tokens: (\d+) \(prompt: (\d+), completion: (\d+)\)/);
  if (!tokenMatch) {
    // Try old format "(humanizado: X + Y = Z tokens)"
    const oldMatch = message.match(/\(humanizado: (\d+) \+ (\d+) = (\d+) tokens\)/);
    if (oldMatch) {
      const cleanMsg = message.replace(/\s*\(humanizado: \d+ \+ \d+ = \d+ tokens\)/, "").trim();
      return {
        cleanMessage: cleanMsg,
        tokens: { total: parseInt(oldMatch[3]), prompt: 0, completion: 0 },
        humanizeBreakdown: `Geração: ${oldMatch[1]} + Humanização: ${oldMatch[2]} = ${oldMatch[3]}`,
      };
    }
    return { cleanMessage: message, tokens: null, humanizeBreakdown: null };
  }

  let cleanMsg = message
    .replace(/ \| Tokens: \d+ \(prompt: \d+, completion: \d+\)/, "")
    .replace(/ \| Geração: \d+ \+ Humanização: \d+ = \d+ tokens/, "")
    .trim();

  return {
    cleanMessage: cleanMsg,
    tokens: { total: parseInt(tokenMatch[1]), prompt: parseInt(tokenMatch[2]), completion: parseInt(tokenMatch[3]) },
    humanizeBreakdown,
  };
}

function LogContent({ nodeLabel, message }: { nodeLabel: string; message: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { cleanMessage, tokens, humanizeBreakdown } = parseTokensFromMessage(message);
  const isLong = (cleanMessage?.length || 0) > 60;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cleanMessage) {
      navigator.clipboard.writeText(cleanMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="flex-1 min-w-0 -mt-0.5">
      <div className="flex items-center gap-1">
        <p className="text-[11px] font-semibold truncate flex-1">{nodeLabel}</p>
        {cleanMessage && (
          <button onClick={handleCopy} className="shrink-0 p-0.5 rounded hover:bg-muted/60 transition-colors" title="Copiar">
            {copied ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
          </button>
        )}
      </div>
      {cleanMessage && (
        <div className="mt-0.5">
          {isLong ? (
            <>
              <p
                className={cn("text-[10px] text-muted-foreground break-words", !expanded && "line-clamp-2")}
                style={{ cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              >
                {cleanMessage}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="text-[9px] text-primary hover:underline mt-0.5"
              >
                {expanded ? "Ver menos" : "Ver tudo"}
              </button>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground break-words">{cleanMessage}</p>
          )}
        </div>
      )}
      {tokens && (
        <div className="flex flex-col gap-0.5 mt-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded px-1.5 py-0.5 border border-violet-500/20">
              <Zap className="h-2.5 w-2.5" />
              {tokens.total} tokens
            </span>
            <span className="text-[8px] text-muted-foreground">
              (in: {tokens.prompt} · out: {tokens.completion})
            </span>
          </div>
          {humanizeBreakdown && (
            <span className="text-[8px] text-amber-600 dark:text-amber-400 font-medium">
              ✍️ {humanizeBreakdown}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ExecutionHistoryPanel({ automationId, nodes, onHighlightNodes }: ExecutionHistoryPanelProps) {
  const { currentOrganization } = useOrganization();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const nodeMap = new Map(safeNodes.map((n) => [n.id, n]));

  const fetchExecutions = useCallback(async () => {
    if (!automationId || !currentOrganization?.id) return;
    setLoading(true);

    const { data: execs } = await (supabase as any)
      .from("automation_executions")
      .select("id, status, chat_id, created_at, completed_at, context")
      .eq("automation_id", automationId)
      .eq("organization_id", currentOrganization.id)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!execs || execs.length === 0) {
      setExecutions([]);
      setLoading(false);
      return;
    }

    // Fetch logs and chat names in parallel
    const execIds = execs.map((e: any) => e.id);
    const chatIds = [...new Set(execs.map((e: any) => e.chat_id))];

    const [logsRes, chatsRes] = await Promise.all([
      (supabase as any)
        .from("automation_execution_logs")
        .select("id, execution_id, node_id, status, message, created_at")
        .in("execution_id", execIds)
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("chats")
        .select("id, custom_name, wa_name, phone")
        .in("id", chatIds),
    ]);

    const logsMap = new Map<string, ExecutionLog[]>();
    for (const log of (logsRes.data || [])) {
      const arr = logsMap.get(log.execution_id) || [];
      arr.push(log);
      logsMap.set(log.execution_id, arr);
    }

    const chatMap = new Map<string, string>();
    for (const chat of (chatsRes.data || [])) {
      chatMap.set(chat.id, chat.custom_name || chat.wa_name || chat.phone || "Lead");
    }

    setExecutions(
      execs.map((e: any) => ({
        ...e,
        logs: logsMap.get(e.id) || [],
        chatName: chatMap.get(e.chat_id) || "Lead",
      }))
    );
    setLoading(false);
  }, [automationId, currentOrganization?.id]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const getNodeLabel = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    return node?.data?.label || node?.type || "Nó";
  };

  const getNodeType = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    return node?.type || "unknown";
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border w-80">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Execuções</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchExecutions} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <History className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs">Nenhuma execução encontrada</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {executions.map((exec) => {
              const isExpanded = expandedId === exec.id;
              const statusCfg = STATUS_CONFIG[exec.status] || STATUS_CONFIG.running;
              const StatusIcon = statusCfg.icon;

              return (
                <div key={exec.id} className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                  {/* Header */}
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : exec.id);
                      if (!isExpanded && onHighlightNodes) {
                        onHighlightNodes(exec.logs.map((l) => l.node_id));
                      } else if (isExpanded && onHighlightNodes) {
                        onHighlightNodes([]);
                      }
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <StatusIcon className={cn("h-4 w-4 shrink-0", statusCfg.color, exec.status === "running" && "animate-spin")} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium truncate">{exec.chatName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-[10px] font-semibold", statusCfg.color)}>{statusCfg.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(exec.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    {(() => {
                      const totalTokens = exec.logs.reduce((sum, log) => {
                        const { tokens } = parseTokensFromMessage(log.message);
                        return sum + (tokens?.total || 0);
                      }, 0);
                      return (
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                            {exec.logs.length} nós
                          </span>
                          {totalTokens > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full px-1.5 py-0.5">
                              <Zap className="h-2 w-2" />
                              {totalTokens}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </button>

                  {/* Expanded: node execution timeline */}
                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <div className="relative ml-2">
                        {/* Vertical line */}
                        <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-border" />

                        {exec.logs.map((log, i) => {
                          const isSuccess = log.status === "success";
                          const isLast = i === exec.logs.length - 1;
                          return (
                            <div key={log.id} className="relative flex items-start gap-3 py-1.5">
                              {/* Dot */}
                              <div
                                className={cn(
                                  "relative z-10 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                                  isSuccess
                                    ? "border-emerald-500 bg-emerald-500/20"
                                    : "border-destructive bg-destructive/20"
                                )}
                              >
                                <div
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    isSuccess ? "bg-emerald-500" : "bg-destructive"
                                  )}
                                />
                              </div>

                              {/* Content */}
                              <LogContent nodeLabel={getNodeLabel(log.node_id)} message={log.message} />
                            </div>
                          );
                        })}

                        {/* Current wait state indicator */}
                        {(exec.status === "waiting_response" || exec.status === "waiting") && (
                          <div className="relative flex items-start gap-3 py-1.5">
                            <div className="relative z-10 h-4 w-4 rounded-full border-2 border-amber-500 bg-amber-500/20 flex items-center justify-center shrink-0">
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0 -mt-0.5">
                              <p className="text-[11px] font-semibold text-amber-500">
                                {exec.status === "waiting_response" ? "Aguardando resposta do lead..." : "Aguardando delay..."}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
