import { useEffect, useState, useCallback } from "react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import KanbanBoard from "./KanbanBoard";
import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay } from "date-fns";
import { Database, TrendingUp, Users, Calendar, Workflow, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagGroup {
  id: string;
  name: string;
  color: string;
  tag_ids: string[];
}

interface Funnel {
  id: string;
  name: string;
  visualization_type: "funnel" | "pie" | "bar" | "kanban";
  tag_order: string[];
  data_source?: "tags" | "crm" | "automations" | "finance" | "events";
  config?: any;
}

interface FunnelVisualizationProps {
  funnel: Funnel;
  tags: Tag[];
  groups?: TagGroup[];
  dateRange?: DateRange;
  perLead?: boolean;
}

const resolveOrderItems = (tagOrder: string[], tags: Tag[], groups: TagGroup[]) => {
  if (!tagOrder) return [];
  return tagOrder.map(item => {
    if (item.startsWith("group:")) {
      const groupId = item.replace("group:", "");
      const group = groups.find(g => g.id === groupId);
      if (!group) return null;
      return { type: "group" as const, id: groupId, name: group.name, color: group.color || "#6B7280", tagIds: group.tag_ids };
    }
    const tag = tags.find(t => t.id === item);
    if (!tag) return null;
    return { type: "tag" as const, id: tag.id, name: tag.name, color: tag.color, tagIds: [tag.id] };
  }).filter(Boolean) as Array<{ type: "group" | "tag"; id: string; name: string; color: string; tagIds: string[] }>;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/80 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label || payload[0].name}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].color || payload[0].payload.color }} />
          <p className="text-lg font-black tracking-tight">{payload[0].value.toLocaleString()}</p>
        </div>
      </div>
    );
  }
  return null;
};

const EMPTY_GROUPS: any[] = [];

const FunnelVisualization = ({ funnel, tags, groups = EMPTY_GROUPS, dateRange, perLead }: FunnelVisualizationProps) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stringify complex dependencies to prevent reference-based infinite loops
  const dateRangeStr = JSON.stringify(dateRange);
  const funnelStr = JSON.stringify({ id: funnel.id, data_source: funnel.data_source, tag_order: funnel.tag_order, config: funnel.config });
  const tagsStr = JSON.stringify(tags.map(t => ({ id: t.id, color: t.color })));
  const groupsStr = JSON.stringify(groups.map(g => ({ id: g.id, tag_ids: g.tag_ids })));

  const fetchData = useCallback(async () => {
    // Prevent redundant loading states if we already have data and dependencies haven't changed
    // (Though here we want to fetch when they DO change)
    setLoading(true);
    try {
      const source = funnel.data_source || 'tags';
      const startDate = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null;
      const endDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : null;

      if (source === 'tags') {
        const items = resolveOrderItems(funnel.tag_order, tags, groups);
        if (items.length === 0) { setData([]); setLoading(false); return; }

        const allTagIds = [...new Set(items.flatMap(i => i.tagIds))];
        let query = supabase.from('chat_tags').select('chat_id, tag_id').in('tag_id', allTagIds);
        if (startDate) query = query.gte('assigned_at', startDate);
        if (endDate) query = query.lte('assigned_at', endDate);
        const { data: allChatTags, error } = await query;
        if (error) throw error;

        if (perLead) {
          const seenChats = new Set<string>();
          const result = items.map(item => {
            const chatIdsForItem = new Set<string>(
              (allChatTags || []).filter((ct: any) => item.tagIds.includes(ct.tag_id)).map((ct: any) => ct.chat_id as string)
            );
            let uniqueCount = 0;
            chatIdsForItem.forEach(chatId => {
              if (!seenChats.has(chatId)) { seenChats.add(chatId); uniqueCount++; }
            });
            return { name: item.name, value: uniqueCount, color: item.color };
          });
          setData(result);
        } else {
          const result = items.map(item => {
            const matching = (allChatTags || []).filter((ct: any) => item.tagIds.includes(ct.tag_id));
            if (item.type === "group") {
              const uniqueChats = new Set(matching.map((ct: any) => ct.chat_id));
              return { name: item.name, value: uniqueChats.size, color: item.color };
            }
            return { name: item.name, value: matching.length, color: item.color };
          });
          setData(result);
        }
      } else if (source === 'crm') {
        const funnelId = funnel.config?.funnel_id;
        if (!funnelId) { setData([]); setLoading(false); return; }

        const [stagesRes, entriesRes] = await Promise.all([
          supabase.from('funnel_stages').select('id, name, color, order_position').eq('funnel_id', funnelId).order('order_position'),
          supabase.from('chat_funnel_stage').select('stage_id, chat_id').eq('funnel_id', funnelId)
        ]);

        if (stagesRes.error) throw stagesRes.error;

        const result = (stagesRes.data || []).map((stage: any) => {
          const count = (entriesRes.data || []).filter((e: any) => e.stage_id === stage.id).length;
          return { name: stage.name, value: count, color: stage.color || '#3B82F6' };
        });
        setData(result);
      } else if (source === 'finance') {
        let query = supabase.from('transactions').select('amount, created_at, product_name');
        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);
        const { data: txs, error } = await query;
        if (error) throw error;

        const groupsValues: Record<string, number> = {};
        txs?.forEach((t: any) => {
          const key = t.product_name || 'Vendas Geral';
          groupsValues[key] = (groupsValues[key] || 0) + Number(t.amount);
        });
        const result = Object.entries(groupsValues).map(([name, value]) => ({
          name, value, color: '#' + Math.floor(Math.random() * 16777215).toString(16)
        }));
        setData(result);
      } else if (source === 'events') {
        let query = supabase.from('calendar_events').select('id, status, created_at');
        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);
        const { data: events, error } = await query;
        if (error) throw error;

        const statusMap: Record<string, number> = {};
        events?.forEach((e: any) => {
          const s = e.status || 'Pendente';
          statusMap[s] = (statusMap[s] || 0) + 1;
        });
        const result = Object.entries(statusMap).map(([name, value]) => ({
          name, value, color: name === 'Confirmado' ? '#10B981' : (name === 'Cancelado' ? '#EF4444' : '#F59E0B')
        }));
        setData(result);
      } else if (source === 'automations') {
        const automationId = funnel.config?.automation_id;
        if (!automationId) {
          // Fallback: show all automations summary by status
          const { data: execs, error } = await supabase.from('automation_executions').select('status, created_at');
          if (error) throw error;
          const statusLabels: Record<string, string> = {
            'completed': 'Concluído', 'running': 'Em execução', 'waiting': 'Aguardando',
            'waiting_response': 'Aguardando Resposta', 'failed': 'Falhou', 'paused': 'Pausado'
          };
          const statusColors: Record<string, string> = {
            'completed': '#10B981', 'running': '#3B82F6', 'waiting': '#F59E0B',
            'waiting_response': '#8B5CF6', 'failed': '#EF4444', 'paused': '#6B7280'
          };
          const statusMap: Record<string, number> = {};
          execs?.forEach((e: any) => {
            const s = e.status || 'completed';
            statusMap[s] = (statusMap[s] || 0) + 1;
          });
          const result = Object.entries(statusMap).map(([name, value]) => ({
            name: statusLabels[name] || name, value, color: statusColors[name] || '#6366F1'
          }));
          setData(result);
        } else {
          // Specific automation: show node-by-node flow metrics (like CRM stages)
          const [nodesRes, statsRes, execsRes] = await Promise.all([
            supabase.from('automation_nodes')
              .select('id, node_type, label, position_y, config')
              .eq('automation_id', automationId)
              .order('position_y', { ascending: true }),
            supabase.from('automation_node_stats')
              .select('node_id, total_reached, total_responded')
              .eq('automation_id', automationId),
            supabase.from('automation_executions')
              .select('id, status, chat_id')
              .eq('automation_id', automationId)
          ]);

          if (nodesRes.error) throw nodesRes.error;

          const statsMap = new Map<string, any>();
          (statsRes.data || []).forEach((s: any) => statsMap.set(s.node_id, s));

          const totalExecutions = (execsRes.data || []).length;
          const completedExecs = (execsRes.data || []).filter((e: any) => e.status === 'completed').length;
          const uniqueLeads = new Set((execsRes.data || []).map((e: any) => e.chat_id)).size;

          const nodeTypeLabels: Record<string, string> = {
            'trigger': '🟢 Gatilho', 'send_message': '💬 Mensagem', 'ask_question': '❓ Pergunta',
            'condition': '🔀 Condição', 'delay': '⏳ Delay', 'action': '⚡ Ação',
            'ai_agent': '🤖 Agente IA', 'send_ai_response': '🧠 Resposta IA',
            'wait_response': '⏸️ Aguardar', 'capture_info': '📝 Capturar',
            'http_request': '🌐 HTTP', 'code': '💻 Código', 'filter': '🔍 Filtro',
            'router': '🔀 Roteador', 'send_media': '📎 Mídia', 'crm_move': '📊 Mover CRM',
            'edit_fields': '✏️ Editar Campos', 'stop_bot': '🛑 Parar Bot',
            'bot_toggle': '🔄 Bot Toggle', 'loop': '🔁 Loop', 'agenda': '📅 Agenda',
            'financeiro': '💰 Financeiro', 'follow_up_ai': '🔔 Follow-up IA',
            'intent_router': '🎯 Roteador de Intenção',
          };

          const nodeTypeColors: Record<string, string> = {
            'trigger': '#10B981', 'send_message': '#3B82F6', 'ask_question': '#8B5CF6',
            'condition': '#F59E0B', 'delay': '#6B7280', 'action': '#EF4444',
            'ai_agent': '#7C3AED', 'send_ai_response': '#6366F1', 'wait_response': '#F97316',
            'capture_info': '#14B8A6', 'http_request': '#06B6D4', 'code': '#84CC16',
            'filter': '#EC4899', 'router': '#F59E0B', 'send_media': '#0EA5E9',
            'crm_move': '#8B5CF6', 'edit_fields': '#64748B', 'stop_bot': '#DC2626',
            'bot_toggle': '#10B981', 'loop': '#F97316', 'agenda': '#0EA5E9',
            'financeiro': '#10B981', 'follow_up_ai': '#7C3AED', 'intent_router': '#EC4899',
          };

          // Build node flow data
          const nodes = (nodesRes.data || []).filter((n: any) => n.node_type !== 'trigger' || true);
          const result = nodes.map((node: any) => {
            const stats = statsMap.get(node.id);
            const label = node.label || nodeTypeLabels[node.node_type] || node.node_type;
            return {
              name: label,
              value: stats?.total_reached || 0,
              responded: stats?.total_responded || 0,
              color: nodeTypeColors[node.node_type] || '#6366F1',
            };
          });

          // Add summary row at the top
          result.unshift({
            name: '📊 Total Execuções',
            value: totalExecutions,
            responded: completedExecs,
            color: '#3B82F6',
          });

          setData(result);
        }
      }
    } catch (error) {
      console.error('Error fetching funnel data:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelStr, dateRangeStr, perLead, groupsStr, tagsStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderVisualization = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[300px] gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando dados...</p>
        </div>
      );
    }

    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
      return (
        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground glass rounded-2xl border border-dashed border-border/50 bg-muted/5">
          <Database className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-sm">Nenhum dado encontrado para o período</p>
        </div>
      );
    }

    switch (funnel.visualization_type) {
      case "kanban":
        return <KanbanBoard tagOrder={funnel.tag_order} tags={tags} />;

      case "pie":
        return (
          <div className="glass rounded-2xl p-4 overflow-hidden border-white/5 bg-card/10">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  stroke="none"
                  animationBegin={0}
                  animationDuration={1500}
                >
                  {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity outline-none" />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case "bar":
        return (
          <div className="glass rounded-2xl p-4 border-white/5 bg-card/10">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: '600' }} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px', fontWeight: '600' }} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} animationBegin={0} animationDuration={1500}>
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      style={{ filter: `drop-shadow(0 4px 12px ${entry.color}44)` }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case "funnel":
      default:
        return (
          <div className="space-y-6 px-2">
            {data.map((item, index) => {
              const width = 100 - (index * 8);
              const prevValue = index > 0 ? data[index - 1].value : 0;
              const conversion = index > 0 && prevValue > 0 ? ((item.value / prevValue) * 100).toFixed(1) : (index === 0 ? "100" : "0.0");
              const isAutomation = funnel.data_source === 'automations';
              const responded = item.responded;
              const responseRate = isAutomation && item.value > 0 && responded !== undefined
                ? ((responded / item.value) * 100).toFixed(1) : null;

              return (
                <div key={`${item.name}-${index}`} className="space-y-2 group animate-in slide-in-from-bottom-4 duration-500 ease-out" style={{ animationDelay: `${index * 0.15}s` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-4 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{item.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-black tracking-tight">
                            {funnel.data_source === 'finance' ? `R$ ${item.value.toLocaleString('pt-BR')}` : item.value.toLocaleString('pt-BR')}
                          </span>
                          {isAutomation && responded !== undefined && responded > 0 && (
                            <span className="text-xs text-muted-foreground font-medium">
                              {responded} responderam
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      {index > 0 && (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-muted-foreground/60">CONVERSÃO</span>
                          <span className="text-xs font-black text-primary/80 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                            {conversion}%
                          </span>
                        </div>
                      )}
                      {responseRate && (
                        <span className="text-[10px] font-bold text-muted-foreground/50">
                          Resposta: {responseRate}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative h-12 glass rounded-2xl overflow-hidden border border-white/5 bg-white/5 transition-all duration-300 group-hover:bg-white/10 group-hover:border-white/10">
                    <div
                      className="h-full rounded-2xl transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1)"
                      style={{
                        width: `${Math.max(width, 5)}%`,
                        background: `linear-gradient(90deg, ${item.color}cc, ${item.color}33)`,
                        boxShadow: `inset 0 0 20px ${item.color}22`
                      }}
                    />
                    <div className="absolute inset-0 flex items-center px-4">
                      {index === 0 && <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">{isAutomation ? 'Início do Fluxo' : 'Topo do Funil'}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
    }
  };

  const getSourceIcon = () => {
    switch (funnel.data_source) {
      case 'crm': return <GitBranch className="h-4 w-4 text-primary" />;
      case 'finance': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'events': return <Calendar className="h-4 w-4 text-amber-500" />;
      case 'automations': return <Workflow className="h-4 w-4 text-indigo-500" />;
      default: return <Users className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card className="h-full min-h-[480px] flex flex-col border-white/10 shadow-xl bg-card/30 backdrop-blur-xl group overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-background/50 border shadow-sm">
              {getSourceIcon()}
            </div>
            <CardTitle className="text-sm font-bold tracking-tight">{funnel.name}</CardTitle>
          </div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded-full">
            {funnel.data_source || 'Etiquetas'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto custom-scrollbar pt-2">
        {renderVisualization()}
      </CardContent>
    </Card>
  );
};

export default FunnelVisualization;
