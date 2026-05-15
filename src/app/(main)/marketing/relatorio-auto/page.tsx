"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Eye, Copy } from "lucide-react";

interface RelatorioConfig {
  id: string;
  cliente_nome: string;
  whatsapp: string;
  dia_semana: number;
  hora: number;
  ativo: boolean;
}

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const TEMPLATE_PADRAO = `📊 *Relatório de Tráfego Semanal*
📅 Período: {{periodo_inicio}} a {{periodo_fim}}

💰 Investido: {{investimento}}
📥 Leads gerados: {{total_leads}}
💵 CPL médio: {{cpl_medio}}
✅ Qualificados: {{leads_qualificados}} ({{taxa_qualificacao}}%)
📅 Reuniões: {{reunioes}}
🤝 Fechamentos: {{fechamentos}}

{{#se_roas}}💎 Retorno: {{receita}} ({{roas}}x o investimento){{/se_roas}}

🏆 Top anúncios:
{{top_anuncios}}

Qualquer dúvida, estamos à disposição!`;

const VARIAVEIS = [
  { key: "{{periodo_inicio}}", desc: "Data início (DD/MM)" },
  { key: "{{periodo_fim}}", desc: "Data fim (DD/MM)" },
  { key: "{{investimento}}", desc: "Total investido (R$)" },
  { key: "{{total_leads}}", desc: "Total de leads" },
  { key: "{{cpl_medio}}", desc: "CPL médio (R$)" },
  { key: "{{leads_qualificados}}", desc: "Leads qualificados" },
  { key: "{{taxa_qualificacao}}", desc: "Taxa de qualificação (%)" },
  { key: "{{reunioes}}", desc: "Reuniões realizadas" },
  { key: "{{fechamentos}}", desc: "Fechamentos" },
  { key: "{{receita}}", desc: "Receita gerada (R$)" },
  { key: "{{roas}}", desc: "ROAS (ex: 2.5)" },
  { key: "{{top_anuncios}}", desc: "Top 3 anúncios formatado" },
  { key: "{{cliente_nome}}", desc: "Nome do cliente" },
  { key: "{{#se_roas}}...{{/se_roas}}", desc: "Condicional: só aparece se ROAS > 0" },
];

export default function RelatorioAutoPage() {
  const [configs, setConfigs] = useState<RelatorioConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [template, setTemplate] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("relatorio_template") || TEMPLATE_PADRAO;
    return TEMPLATE_PADRAO;
  });
  const [showVars, setShowVars] = useState(false);

  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [diaSemana, setDiaSemana] = useState(1);
  const [hora, setHora] = useState(8);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await supabase.from("relatorio_config").select("*").order("cliente_nome");
    setConfigs((data || []) as RelatorioConfig[]);
    setLoading(false);
  }

  async function addConfig() {
    if (!nome.trim() || !whatsapp.trim()) { toast.error("Preencha nome e WhatsApp"); return; }
    const { error } = await supabase.from("relatorio_config").insert({
      cliente_nome: nome.trim(), whatsapp: whatsapp.replace(/\D/g, ""),
      dia_semana: diaSemana, hora: hora, ativo: true,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Configuração adicionada!");
    setNome(""); setWhatsapp("");
    loadData();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("relatorio_config").update({ ativo: !ativo }).eq("id", id);
    setConfigs((prev) => prev.map((c) => c.id === id ? { ...c, ativo: !ativo } : c));
  }

  async function deleteConfig(id: string) {
    if (!confirm("Remover esta configuração?")) return;
    await supabase.from("relatorio_config").delete().eq("id", id);
    setConfigs((prev) => prev.filter((c) => c.id !== id));
    toast.success("Removido!");
  }

  function salvarTemplate() {
    localStorage.setItem("relatorio_template", template);
    toast.success("Template salvo!");
  }

  function resetarTemplate() {
    setTemplate(TEMPLATE_PADRAO);
    localStorage.setItem("relatorio_template", TEMPLATE_PADRAO);
    toast.success("Template resetado!");
  }

  function inserirVariavel(v: string) {
    setTemplate((prev) => prev + v);
  }

  async function previewRelatorio() {
    setPreviewLoading(true);
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 7);
    const dataInicio = inicio.toISOString().split("T")[0];
    const dataFim = fim.toISOString().split("T")[0];

    try {
      const res = await fetch(`/api/relatorio-semanal?data_inicio=${dataInicio}&data_fim=${dataFim}`);
      const data = await res.json();
      const r = data.resumo;

      const fmtMoeda = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
      const fmtData = (d: string) => d.split("-").reverse().join("/");

      const topFormatado = (data.top_anuncios || []).map((a: { nome: string; leads: number; cpl: number }, i: number) =>
        `${i + 1}. ${a.nome} — ${a.leads} leads (CPL ${fmtMoeda(a.cpl)})`
      ).join("\n");

      let msg = template
        .replace(/\{\{periodo_inicio\}\}/g, fmtData(dataInicio))
        .replace(/\{\{periodo_fim\}\}/g, fmtData(dataFim))
        .replace(/\{\{investimento\}\}/g, fmtMoeda(r.investimento_total))
        .replace(/\{\{total_leads\}\}/g, String(r.total_leads))
        .replace(/\{\{cpl_medio\}\}/g, fmtMoeda(r.cpl_medio))
        .replace(/\{\{leads_qualificados\}\}/g, String(r.leads_qualificados))
        .replace(/\{\{taxa_qualificacao\}\}/g, String(Math.round(r.taxa_qualificacao)))
        .replace(/\{\{reunioes\}\}/g, String(r.reunioes_realizadas))
        .replace(/\{\{fechamentos\}\}/g, String(r.fechamentos))
        .replace(/\{\{receita\}\}/g, fmtMoeda(r.receita_gerada))
        .replace(/\{\{roas\}\}/g, r.roas.toFixed(1))
        .replace(/\{\{top_anuncios\}\}/g, topFormatado)
        .replace(/\{\{cliente_nome\}\}/g, configs[0]?.cliente_nome || "Cliente");

      if (r.roas > 0) {
        msg = msg.replace(/\{\{#se_roas\}\}([\s\S]*?)\{\{\/se_roas\}\}/g, "$1");
      } else {
        msg = msg.replace(/\{\{#se_roas\}\}[\s\S]*?\{\{\/se_roas\}\}/g, "");
      }

      setPreview(msg);
    } catch {
      toast.error("Erro ao gerar preview");
    }
    setPreviewLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Relatório Automático</h1>

      {/* Template da mensagem */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Template da Mensagem</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowVars(!showVars)}>
                {showVars ? "Esconder variáveis" : "Ver variáveis"}
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={resetarTemplate}>Resetar</Button>
              <Button size="sm" className="text-xs" onClick={salvarTemplate}>Salvar template</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showVars && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 p-3 bg-muted/30 rounded-lg border">
              <p className="col-span-full text-xs text-muted-foreground mb-1">Clique para inserir no cursor:</p>
              {VARIAVEIS.map((v) => (
                <button key={v.key} onClick={() => inserirVariavel(v.key)} className="text-left px-2 py-1 text-[11px] rounded hover:bg-muted transition-colors">
                  <code className="text-primary">{v.key}</code>
                  <span className="text-muted-foreground ml-1">— {v.desc}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={14}
            className="w-full text-xs font-mono bg-transparent border rounded-lg p-3 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </CardContent>
      </Card>

      {/* Adicionar destinatário */}
      <Card>
        <CardHeader><CardTitle className="text-base">Destinatários</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Lucas Santos" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp (DDD + número)</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="75999998888" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dia do envio</Label>
              <select value={diaSemana} onChange={(e) => setDiaSemana(Number(e.target.value))} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Horário</Label>
              <select value={hora} onChange={(e) => setHora(Number(e.target.value))} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2">
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
              </select>
            </div>
            <Button onClick={addConfig}><Plus size={14} className="mr-1" />Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de configurados */}
      {configs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Configurados ({configs.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={previewRelatorio} disabled={previewLoading}>
                <Eye size={14} className="mr-1" />{previewLoading ? "Gerando..." : "Preview"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {configs.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleAtivo(c.id, c.ativo)}>
                      <Badge className={c.ativo ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </button>
                    <div>
                      <p className="font-medium text-sm">{c.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">{c.whatsapp} · {DIAS[c.dia_semana]} às {String(c.hora).padStart(2, "0")}:00</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteConfig(c.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Preview da Mensagem</CardTitle>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(preview); toast.success("Copiado!"); }}>
                <Copy size={14} className="mr-1" />Copiar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-[#0b1622] rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-green-300 max-h-[400px] overflow-auto">
              {preview}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
