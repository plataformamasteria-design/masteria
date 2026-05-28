"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import {
  FileInput, Save, Loader2, AlertCircle, CheckCircle2,
  ChevronDown, ArrowRight, FileText, Users, Zap,
  RefreshCw, ExternalLink, Info, ChevronRight, Eye,
  MessageSquare, Calendar, Phone, Mail, Hash,
  ShieldAlert, RotateCcw,
} from "lucide-react";
import type { MetaLeadForm } from "@/app/api/meta/leadforms/route";
import type { LeadgenRoutingConfig, LeadgenFormMapping } from "@/lib/meta-leadgen-kanban";
import { getMetaAuthUrl } from "@/app/actions/meta-connect";


const fetcher = (url: string) => fetch(url).then(r => r.json());

interface KanbanBoard {
  id: string;
  name: string;
  stages: { id: string; title: string; type: string }[];
}

interface FormDetails {
  formId: string;
  name: string;
  status: string;
  leads_count: number;
  questions: { key: string; label: string; type: string; options?: string[] }[];
  recent_leads: { id: string; created_time: string; field_data: { name: string; values: string[] }[] }[];
}

// ─── BoardStageSelector ───────────────────────────────────────────────────────

function BoardStageSelector({
  boards, selectedBoardId, selectedStageId, onBoardChange, onStageChange, uid,
}: {
  boards: KanbanBoard[];
  selectedBoardId: string;
  selectedStageId: string;
  onBoardChange: (id: string) => void;
  onStageChange: (id: string) => void;
  uid: string;
}) {
  const selectedBoard = boards.find(b => b.id === selectedBoardId);
  const stages = selectedBoard?.stages.filter(s => s.type !== "WIN" && s.type !== "LOSS") || [];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <select
          id={`board-${uid}`}
          value={selectedBoardId}
          onChange={e => { onBoardChange(e.target.value); onStageChange(""); }}
          className="appearance-none bg-white/[0.04] border border-border rounded-xl pl-3 pr-8 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer min-w-[160px]"
        >
          <option value="">Selecionar Pipeline…</option>
          {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground/40 pointer-events-none" />
      </div>

      {selectedBoardId && (
        <>
          <ArrowRight className="h-3 w-3 text-foreground/30 shrink-0" />
          <div className="relative">
            <select
              id={`stage-${uid}`}
              value={selectedStageId}
              onChange={e => onStageChange(e.target.value)}
              className="appearance-none bg-white/[0.04] border border-border rounded-xl pl-3 pr-8 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer min-w-[150px]"
            >
              <option value="">1º Estágio (padrão)</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground/40 pointer-events-none" />
          </div>
        </>
      )}
    </div>
  );
}

// ─── FieldTypeIcon ────────────────────────────────────────────────────────────

function FieldTypeIcon({ type }: { type: string }) {
  const t = type?.toLowerCase() || "";
  if (t.includes("phone")) return <Phone className="h-3 w-3 text-emerald-400" />;
  if (t.includes("email")) return <Mail className="h-3 w-3 text-blue-400" />;
  if (t.includes("number")) return <Hash className="h-3 w-3 text-violet-400" />;
  return <MessageSquare className="h-3 w-3 text-foreground/40" />;
}

// ─── TagSelector ──────────────────────────────────────────────────────────────

interface Tag { id: string; name: string; color: string; }

function TagSelector({ selectedIds, onChange }: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: tagsData, mutate: mutateTags } = useSWR<{ data: Tag[] }>(
    '/api/v1/tags?limit=100', fetcher, { revalidateOnFocus: false }
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#8B5CF6');
  const [saving2, setSaving2] = useState(false);

  const allTags: Tag[] = tagsData?.data || [];
  const selected = allTags.filter(t => selectedIds.includes(t.id));
  const filtered = allTags.filter(t =>
    !selectedIds.includes(t.id) && t.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving2(true);
    try {
      const res = await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      const tag = await res.json();
      if (tag.id) {
        onChange([...selectedIds, tag.id]);
        setNewName('');
        setCreating(false);
        mutateTags();
      }
    } finally { setSaving2(false); }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 mb-1">
        {selected.map(t => (
          <span key={t.id} style={{ backgroundColor: t.color + '22', borderColor: t.color + '55', color: t.color }}
            className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border">
            {t.name}
            <button onClick={() => toggle(t.id)} className="ml-0.5 opacity-60 hover:opacity-100 leading-none">×</button>
          </span>
        ))}
        <button onClick={() => setOpen(v => !v)}
          className="text-[11px] text-foreground/50 hover:text-primary px-2 py-0.5 rounded-full border border-dashed border-border hover:border-primary transition-all">
          + Etiqueta
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-xl border border-border bg-background shadow-xl p-2 space-y-1.5">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar etiqueta…"
            className="w-full text-xs bg-white/5 border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary" />
          <div className="max-h-36 overflow-y-auto space-y-0.5">
            {filtered.map(t => (
              <button key={t.id} onClick={() => { toggle(t.id); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className="text-xs truncate">{t.name}</span>
              </button>
            ))}
            {filtered.length === 0 && !creating && (
              <p className="text-[11px] text-foreground/30 px-2 py-1">Nenhuma encontrada</p>
            )}
          </div>
          {creating ? (
            <div className="pt-1.5 border-t border-border space-y-1.5">
              <div className="flex gap-1.5">
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Nome da etiqueta"
                  className="flex-1 text-xs bg-white/5 border border-border rounded-lg px-2 py-1.5 outline-none" />
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent p-0.5" />
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleCreate} disabled={saving2 || !newName.trim()}
                  className="flex-1 text-xs px-2 py-1.5 bg-primary text-primary-foreground rounded-lg font-bold disabled:opacity-50">
                  {saving2 ? '…' : 'Criar'}
                </button>
                <button onClick={() => setCreating(false)}
                  className="text-xs px-2 py-1.5 bg-white/5 rounded-lg">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCreating(true)}
              className="w-full text-[11px] text-primary/70 hover:text-primary py-1 text-left px-2">
              + Criar nova etiqueta
            </button>
          )}
          <button onClick={() => setOpen(false)}
            className="w-full text-[11px] text-foreground/30 hover:text-foreground py-0.5">Fechar</button>
        </div>
      )}
    </div>
  );
}

function _placeholder() { return null;
}

// ─── FormDetailsPanel ─────────────────────────────────────────────────────────

function FormDetailsPanel({ formId, phoneFieldKey, onPhoneFieldChange }: {
  formId: string;
  phoneFieldKey?: string;
  onPhoneFieldChange: (key: string) => void;
}) {
  const { data, isLoading, error } = useSWR<FormDetails>(
    `/api/meta/leadforms/${formId}/details`,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-foreground/40 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando detalhes…
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-xs text-red-400 py-2">Erro ao carregar detalhes do formulário.</p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Campos do formulário */}
      {data.questions.length > 0 && (
        <div>
          <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">
            Campos do formulário
          </p>
          <div className="space-y-1.5">
            {data.questions.map((q, i) => {
              const isPhone = phoneFieldKey === q.key ||
                (!phoneFieldKey && ['phone_number','telefone','phone','celular','whatsapp'].includes(q.key.toLowerCase()));
              return (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${
                  isPhone ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.03] border-border'
                }`}>
                  <FieldTypeIcon type={q.type} />
                  <span className="text-xs text-foreground/80 font-medium flex-1">{q.label || q.key}</span>
                  {isPhone && (
                    <span className="text-[10px] text-emerald-400 font-bold">📞 tel</span>
                  )}
                  {!isPhone && q.type === 'CUSTOM' && (
                    <button onClick={() => onPhoneFieldChange(q.key)}
                      className="text-[10px] text-foreground/30 hover:text-emerald-400 transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-emerald-500/30">
                      usar como tel
                    </button>
                  )}
                  <span className="text-[10px] text-foreground/30 font-mono">{q.type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leads recentes */}
      {data.recent_leads.length > 0 && (
        <div>
          <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">
            Últimos leads recebidos
          </p>
          <div className="space-y-2">
            {data.recent_leads.map(lead => {
              const nameField = lead.field_data.find(f =>
                ["full_name", "nome", "name"].includes(f.name.toLowerCase())
              );
              const phoneField = lead.field_data.find(f =>
                ["phone_number", "telefone", "phone", "celular", "whatsapp"].includes(f.name.toLowerCase())
              );
              const emailField = lead.field_data.find(f =>
                ["email", "e-mail", "email_address"].includes(f.name.toLowerCase())
              );
              const date = lead.created_time
                ? new Date(lead.created_time).toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                : "";

              return (
                <div key={lead.id} className="p-3 rounded-xl bg-white/[0.02] border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      {nameField && (
                        <p className="text-xs font-bold text-foreground">{nameField.values[0]}</p>
                      )}
                      {phoneField && (
                        <p className="text-[11px] text-foreground/60">{phoneField.values[0]}</p>
                      )}
                      {emailField && (
                        <p className="text-[11px] text-foreground/50">{emailField.values[0]}</p>
                      )}
                      {/* Extra fields */}
                      {lead.field_data
                        .filter(f => !["full_name","nome","name","phone_number","telefone","phone","celular","whatsapp","email","e-mail","email_address"].includes(f.name.toLowerCase()))
                        .slice(0, 2)
                        .map(f => (
                          <p key={f.name} className="text-[10px] text-foreground/40">
                            <span className="font-medium">{f.name}:</span> {f.values[0]}
                          </p>
                        ))}
                    </div>
                    {date && (
                      <div className="flex items-center gap-1 shrink-0 text-[10px] text-foreground/30">
                        <Calendar className="h-3 w-3" />
                        {date}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.questions.length === 0 && data.recent_leads.length === 0 && (
        <p className="text-xs text-foreground/30 py-2">
          Nenhum detalhe disponível. Verifique se o token tem permissão <code className="bg-white/10 px-1 rounded">leads_retrieval</code>.
        </p>
      )}
    </div>
  );
}

// ─── FormCard ─────────────────────────────────────────────────────────────────

function FormCard({
  form, boards, mapping, onMappingChange, onTagsChange, onPhoneFieldChange,
}: {
  form: MetaLeadForm;
  boards: KanbanBoard[];
  mapping: LeadgenFormMapping | null;
  onMappingChange: (formId: string, boardId: string, stageId: string, formName: string) => void;
  onTagsChange: (formId: string, tagIds: string[]) => void;
  onPhoneFieldChange: (formId: string, key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{
    ok: boolean; message: string; fieldDataSent?: { name: string; values: string[] }[];
  } | null>(null);
  const boardId = mapping?.boardId || "";
  const stageId = mapping?.stageId || "";
  const tagIds = mapping?.tagIds || [];
  const phoneFieldKey = mapping?.phoneFieldKey || "";

  const handleSimulate = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await fetch(`/api/meta/leadforms/${form.id}/simulate-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneFieldKey: phoneFieldKey || undefined }),
      });
      const data = await res.json();
      setSimResult({ ok: data.ok, message: data.message || data.error || 'Erro desconhecido', fieldDataSent: data.fieldDataSent });
    } catch (e: any) {
      setSimResult({ ok: false, message: e.message });
    } finally { setSimulating(false); }
  };

  return (
    <div className={`rounded-2xl border transition-all duration-200 ${
      boardId ? "border-primary/30 bg-primary/5" : "border-border bg-white/[0.02]"
    }`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className={`flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 ${
              form.status === "ACTIVE"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-zinc-500/10 border-zinc-500/20"
            }`}>
              <FileText className={`h-4 w-4 ${form.status === "ACTIVE" ? "text-emerald-400" : "text-zinc-400"}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-tight">{form.name}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-[10px] text-foreground/40 font-mono">{form.id}</span>
                {form.page_name && (
                  <span className="text-[10px] text-foreground/40">{form.page_name}</span>
                )}
                <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                  form.status === "ACTIVE"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-zinc-500/15 text-zinc-400"
                }`}>
                  {form.status === "ACTIVE" ? "Ativo" : form.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {form.leads_count !== undefined && (
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-foreground/40" />
                <span className="text-xs font-bold text-foreground/60">
                  {form.leads_count.toLocaleString("pt-BR")} leads
                </span>
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-foreground/50 hover:text-amber-400 hover:bg-amber-500/5 border border-border hover:border-amber-500/20 transition-all disabled:opacity-50"
                title="Simular entrada de lead neste formulário"
              >
                {simulating ? <Loader2 className="h-3 w-3 animate-spin" /> : <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5l10 -10"/></svg>}
                Simular Lead
              </button>
              <a
                id={`btn-download-leads-${form.id}`}
                href={`/api/meta/leadforms/${form.id}/leads-export`}
                download
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-foreground/50 hover:text-emerald-400 hover:bg-emerald-500/5 border border-border hover:border-emerald-500/20 transition-all"
                title="Baixar leads como CSV"
              >
                <ArrowRight className="h-3 w-3 rotate-90" />
                CSV
              </a>
              <button
                id={`btn-expand-form-${form.id}`}
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-foreground/50 hover:text-foreground hover:bg-white/[0.06] border border-border transition-all"
              >
                <Eye className="h-3 w-3" />
                {expanded ? "Ocultar" : "Ver detalhes"}
                <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Routing config */}
        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">
              Enviar leads para →
            </p>
            <BoardStageSelector
              boards={boards}
              selectedBoardId={boardId}
              selectedStageId={stageId}
              onBoardChange={bid => onMappingChange(form.id, bid, stageId, form.name)}
              onStageChange={sid => onMappingChange(form.id, boardId, sid, form.name)}
              uid={form.id}
            />
          </div>

          {boardId && (
            <div>
              <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold mb-2">
                Etiquetas do lead →
              </p>
              <TagSelector
                selectedIds={tagIds}
                onChange={ids => onTagsChange(form.id, ids)}
              />
              {phoneFieldKey && (
                <p className="text-[10px] text-foreground/40 mt-1">
                  📞 Campo de telefone: <code className="bg-white/10 px-1 rounded">{phoneFieldKey}</code>
                  <button onClick={() => onPhoneFieldChange(form.id, '')} className="ml-1 text-foreground/20 hover:text-foreground/50">×</button>
                </p>
              )}
            </div>
          )}

          {boardId && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>Configurado — leads serão enviados para este pipeline automaticamente</span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5">
          <FormDetailsPanel
            formId={form.id}
            phoneFieldKey={phoneFieldKey}
            onPhoneFieldChange={key => onPhoneFieldChange(form.id, key)}
          />
        </div>
      )}

      {/* Simulation Result */}
      {simResult && (
        <div className="border-t border-border px-5 pb-5 bg-black/10">
          <div className={`mt-4 p-4 rounded-xl border text-xs shadow-inner ${
            simResult.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {simResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <p className="font-bold text-sm">{simResult.message}</p>
              </div>
              <button onClick={() => setSimResult(null)} className="opacity-50 hover:opacity-100 hover:bg-white/10 p-1 rounded-md transition-colors">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            {simResult.fieldDataSent && (
              <div className="mt-4 pt-3 border-t border-current/20 space-y-1.5">
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-2">Payload de simulação (fake data gerado via Meta API):</p>
                {simResult.fieldDataSent.map(f => (
                  <div key={f.name} className="flex items-center gap-2 bg-black/20 px-2 py-1.5 rounded-lg font-mono">
                    <span className="opacity-60 min-w-[120px] shrink-0 truncate">{f.name}:</span>
                    <span className="font-medium text-foreground truncate">{f.values[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function FormulariosPage() {
  // Não depende de account_id — a API usa a sessão diretamente (token por empresa)
  const { data: formsData, isLoading: formsLoading, error: formsError, mutate: mutateForms } = useSWR(
    "/api/meta/leadforms",
    fetcher,
  );
  const { data: configData, isLoading: configLoading } = useSWR(
    "/api/marketing/leadgen-config",
    fetcher,
  );
  const { data: boardsRaw } = useSWR("/api/v1/kanbans", fetcher);

  const [defaultBoardId, setDefaultBoardId] = useState("");
  const [defaultStageId, setDefaultStageId] = useState("");
  const [formMappings, setFormMappings] = useState<LeadgenFormMapping[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Hidrata config salva
  useEffect(() => {
    if (configData?.config) {
      const cfg = configData.config as LeadgenRoutingConfig;
      setDefaultBoardId(cfg.defaultBoardId || "");
      setDefaultStageId(cfg.defaultStageId || "");
      setFormMappings(cfg.formMappings || []);
    }
  }, [configData]);

  const forms: MetaLeadForm[] = formsData?.data || [];
  const boards: KanbanBoard[] = Array.isArray(boardsRaw) ? boardsRaw : [];

  const handleFormMappingChange = useCallback((
    formId: string, boardId: string, stageId: string, formName: string,
  ) => {
    setFormMappings(prev => {
      if (!boardId) {
        // Remove o mapping, MAS preserva phoneFieldKey em entrada parcial se existir
        const existing = prev.find(m => m.formId === formId);
        if (existing?.phoneFieldKey) {
          return prev.map(m => m.formId === formId ? { formId, boardId: '', stageId: '', phoneFieldKey: existing.phoneFieldKey } : m);
        }
        return prev.filter(m => m.formId !== formId);
      }
      const existing = prev.find(m => m.formId === formId);
      const newMapping: LeadgenFormMapping = {
        formId, formName, boardId, stageId,
        tagIds: existing?.tagIds,
        phoneFieldKey: existing?.phoneFieldKey,
      };
      const idx = prev.findIndex(m => m.formId === formId);
      if (idx >= 0) { const u = [...prev]; u[idx] = newMapping; return u; }
      return [...prev, newMapping];
    });
  }, []);

  const handleFormTagsChange = useCallback((formId: string, tagIds: string[]) => {
    setFormMappings(prev => {
      const idx = prev.findIndex(m => m.formId === formId);
      if (idx < 0) return prev;
      const u = [...prev]; u[idx] = { ...u[idx], tagIds }; return u;
    });
  }, []);

  const handleFormPhoneFieldChange = useCallback((formId: string, phoneFieldKey: string) => {
    setFormMappings(prev => {
      const idx = prev.findIndex(m => m.formId === formId);
      if (idx >= 0) {
        const u = [...prev]; u[idx] = { ...u[idx], phoneFieldKey: phoneFieldKey || undefined }; return u;
      }
      // Sem mapping ainda: cria entrada parcial só com phoneFieldKey
      // (boardId vazio = não roteado, mas phoneFieldKey fica salvo para quando o board for selecionado)
      if (phoneFieldKey) {
        return [...prev, { formId, boardId: '', stageId: '', phoneFieldKey }];
      }
      return prev;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const config: LeadgenRoutingConfig = {
        defaultBoardId: defaultBoardId || undefined,
        defaultStageId: defaultStageId || undefined,
        formMappings,
      };
      const res = await fetch("/api/marketing/leadgen-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setSaveResult(
        res.ok && data.ok
          ? { ok: true, message: "Configuração salva! Próximos leads serão roteados conforme configurado." }
          : { ok: false, message: data.error || "Erro ao salvar" }
      );
    } catch (err: any) {
      setSaveResult({ ok: false, message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const isLoading = formsLoading || configLoading;
  const notConnected = !formsLoading && (formsError || formsData?.error);
  const apiMessage: string | null = formsData?.message || null;
  // Se conectado mas 0 forms sem erro de rede → provável falta de leads_retrieval
  const likelyMissingPermission = !isLoading && !notConnected && forms.length === 0 && formsData?.pages_checked !== undefined;

  const handleReauth = async () => {
    try {
      const result = await getMetaAuthUrl("/marketing/formularios");
      if (result.success && result.url) window.location.href = result.url;
      else alert(result.error || "Erro ao gerar URL de autorização");
    } catch (e: any) { alert(e.message); }
  };


  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20">
            <FileInput className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-foreground">Formulários Meta</h1>
            <p className="text-xs text-foreground/50">
              Configure qual pipeline Kanban recebe os leads de cada formulário nativo
            </p>
          </div>
        </div>
        <button
          id="btn-refresh-forms"
          onClick={() => mutateForms()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-foreground/60 hover:text-foreground hover:bg-white/[0.06] border border-border transition-all"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-foreground/60 space-y-1">
          <p>
            <span className="font-bold text-foreground/80">Como funciona:</span>{" "}
            Quando alguém preenche um formulário nativo do Meta (Lead Ads), o sistema recebe o evento em tempo real via webhook e cria automaticamente um card no Pipeline Kanban que você configurar.
          </p>
          <p>Os dados preenchidos (nome, telefone, email e campos customizados) são salvos no contato e ficam visíveis no card do Kanban.</p>
        </div>
      </div>

      {/* Não conectado ao Meta */}
      {notConnected && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300">
            <p className="font-bold mb-1">Conta Meta não conectada</p>
            <p className="text-amber-300/70">
              {formsData?.error || "Conecte sua conta Meta em Integrações para visualizar e gerenciar os formulários."}
            </p>
          </div>
        </div>
      )}

      {/* Banner de permissão faltando */}
      {likelyMissingPermission && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/25">
          <ShieldAlert className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-orange-300 mb-1">Permissão <code className="bg-orange-500/20 px-1 rounded">leads_retrieval</code> não autorizada</p>
            <p className="text-xs text-orange-300/70 mb-3">
              Sua conta Meta está conectada, mas o token atual não tem permissão para listar formulários de leads.
              Clique em Re-autorizar para conceder essa permissão.
            </p>
            <button
              id="btn-reauth-meta"
              onClick={handleReauth}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-400 transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-autorizar conta Meta
            </button>
          </div>
        </div>
      )}

      {/* Default config */}
      <div className="rounded-2xl border border-border bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold text-foreground">Configuração Padrão</h2>
          <span className="text-[10px] text-foreground/40 ml-1">— para formulários sem mapeamento específico</span>
        </div>
        <BoardStageSelector
          boards={boards}
          selectedBoardId={defaultBoardId}
          selectedStageId={defaultStageId}
          onBoardChange={setDefaultBoardId}
          onStageChange={setDefaultStageId}
          uid="default"
        />
        {!defaultBoardId && (
          <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Sem configuração padrão, leads de formulários não mapeados serão ignorados
          </p>
        )}
      </div>

      {/* Forms list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Formulários Disponíveis na Conta</h2>
          {!isLoading && !notConnected && (
            <span className="text-[10px] text-foreground/40">
              {forms.length} formulário{forms.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12 gap-2 text-foreground/40">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando formulários…</span>
          </div>
        )}

        {!isLoading && !notConnected && forms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <FileInput className="h-10 w-10 text-foreground/20" />
            <p className="text-sm text-foreground/40">Nenhum formulário encontrado nesta conta</p>
            {apiMessage ? (
              <p className="text-xs text-amber-400/80 max-w-md">{apiMessage}</p>
            ) : (
              <p className="text-xs text-foreground/30">
                Crie um Lead Ad no Gerenciador de Anúncios para que os formulários apareçam aqui
              </p>
            )}
            <a
              href="https://www.facebook.com/adsmanager"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir Gerenciador de Anúncios
            </a>
          </div>
        )}

        <div className="space-y-3">
          {forms.map(form => (
            <FormCard
              key={form.id}
              form={form}
              boards={boards}
              mapping={formMappings.find(m => m.formId === form.id) || null}
              onMappingChange={handleFormMappingChange}
              onTagsChange={handleFormTagsChange}
              onPhoneFieldChange={handleFormPhoneFieldChange}
            />
          ))}
        </div>
      </div>

      {/* Save result */}
      {saveResult && (
        <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
          saveResult.ok
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-red-500/5 border-red-500/20"
        }`}>
          {saveResult.ok
            ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            : <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          }
          <p className={`text-xs ${saveResult.ok ? "text-emerald-300" : "text-red-300"}`}>
            {saveResult.message}
          </p>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {(formMappings.length > 0 || defaultBoardId) && (
          <div className="flex items-center gap-1.5 text-xs text-foreground/40">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            {formMappings.length} formulário{formMappings.length !== 1 ? "s" : ""} configurado{formMappings.length !== 1 ? "s" : ""}
            {defaultBoardId ? " + padrão" : ""}
          </div>
        )}
        <button
          id="btn-save-leadgen-config"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando…" : "Salvar Configuração"}
        </button>
      </div>
    </div>
  );
}
