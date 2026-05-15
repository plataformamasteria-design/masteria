/**
 * @deprecated 2026-05-03 — Notion Read Layer DESLIGADO (P28).
 * Todas as funcoes retornam dados vazios quando NOTION_KEY esta ausente.
 * Consumers devem migrar para Supabase (team_notion_mirror, clientes_receita).
 * Arquivo mantido para compatibilidade — NAO usar em codigo novo.
 * Backup original: docs/backups/desligar-notion/
 *
 * Antigo: Leitura das databases de operacao do Notion.
 */

const NOTION_KEY = process.env.NOTION_API_KEY || "";
const API = "https://api.notion.com/v1";
const HEADERS = {
  Authorization: `Bearer ${NOTION_KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

export const DB_IDS = {
  team: "74207bb81ed24fe7aad47eeb4b43a367",
  clientes: "2549240cff2d486fbd346c4b0ef2a3ae",
  onboarding: "fffb5b1a3b988152960fe2877b92bcdd",
  tarefas: "192b5b1a3b9881298be6dcc35617667c",
  reunioes: "210b5b1a3b98808f8d02f57d493cc9ab",
};

// === Helpers ===

function getText(prop: Record<string, unknown> | undefined): string {
  if (!prop) return "";
  const type = prop.type as string;
  if (type === "title") return ((prop.title as { plain_text: string }[]) || []).map((t) => t.plain_text).join("");
  if (type === "rich_text") return ((prop.rich_text as { plain_text: string }[]) || []).map((t) => t.plain_text).join("");
  if (type === "select") return (prop.select as { name: string } | null)?.name || "";
  if (type === "multi_select") return ((prop.multi_select as { name: string }[]) || []).map((t) => t.name).join(", ");
  if (type === "number") return String(prop.number ?? "");
  if (type === "date") return (prop.date as { start: string } | null)?.start || "";
  if (type === "status") return (prop.status as { name: string } | null)?.name || "";
  if (type === "checkbox") return prop.checkbox ? "true" : "false";
  if (type === "formula") {
    const f = prop.formula as Record<string, unknown>;
    if (f.type === "string") return (f.string as string) || "";
    if (f.type === "number") return String(f.number ?? "");
    if (f.type === "boolean") return f.boolean ? "true" : "false";
    if (f.type === "date") return (f.date as { start: string } | null)?.start || "";
  }
  if (type === "relation") return ((prop.relation as { id: string }[]) || []).map((r) => r.id).join(",");
  if (type === "people") return ((prop.people as { name?: string }[]) || []).map((p) => p.name || "").join(", ");
  if (type === "url") return (prop.url as string) || "";
  if (type === "email") return (prop.email as string) || "";
  if (type === "phone_number") return (prop.phone_number as string) || "";
  if (type === "rollup") {
    const r = prop.rollup as Record<string, unknown>;
    if (r.type === "number") return String(r.number ?? "");
    if (r.type === "array") return String((r.array as unknown[])?.length ?? 0);
  }
  return "";
}

async function queryAllPages(dbId: string, filter?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  if (!NOTION_KEY) return [];
  const all: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  while (true) {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    if (filter) body.filter = filter;
    const res = await fetch(`${API}/databases/${dbId}/query`, {
      method: "POST", headers: HEADERS, body: JSON.stringify(body),
      cache: "no-store",
    } as RequestInit);
    if (!res.ok) break;
    const data = await res.json();
    all.push(...data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return all;
}

function extractProps(row: Record<string, unknown>): Record<string, string> {
  const props = row.properties as Record<string, Record<string, unknown>>;
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(props)) {
    result[key] = getText(val);
  }
  return result;
}

// === Exported Functions ===

export interface TeamMember {
  notion_id: string; nome: string; cargo: string; funcoes: string;
  email: string; telefone: string; status: string;
  [key: string]: string;
}

// Lista fixa de membros (páginas individuais do Notion)
const MEMBROS_IDS = [
  { id: "fffb5b1a-3b98-8135-a4d3-f05ae1b806d7", nome: "Lucas Santos", cargo: "Diretor" },
  { id: "1c2b5b1a-3b98-80b9-a9c5-ddedb2e25640", nome: "Flavio Goes", cargo: "Head de Tráfego" },
  { id: "1f2b5b1a-3b98-80e6-81da-c09f850be672", nome: "Emerson Kleber", cargo: "Gestor Pleno" },
  { id: "24eb5b1a-3b98-8093-b3d6-f75e5563339c", nome: "Fernando", cargo: "Gestor Pleno" },
  { id: "105b5b1a-3b98-8064-bcb5-d02270763b44", nome: "Maria Clara", cargo: "Administrativo" },
  { id: "1f8b5b1a-3b98-8013-9918-ff6725a623c0", nome: "Mariana", cargo: "Closer" },
  { id: "294b5b1a-3b98-80c6-a97b-d7551b6ee64b", nome: "Rogério", cargo: "Closer" },
  { id: "davi-sdr-placeholder", nome: "Davi Brandão", cargo: "SDR" },
  { id: "2edb5b1a-3b98-8030-b5e8-f60f603a420e", nome: "Heber", cargo: "Gestor Junior" },
  { id: "2fdb5b1a-3b98-80fb-9271-e3907981d38a", nome: "Yago Sena", cargo: "Gestor Junior" },
  { id: "326b5b1a-3b98-80c3-93f4-c2c44a92f13c", nome: "Eduardo", cargo: "Gestor Junior" },
];

export async function getTeam(): Promise<TeamMember[]> {
  // Usa a lista fixa combinada com dados da DB Time se disponível
  const dbRows = await queryAllPages(DB_IDS.team).catch(() => []);
  const dbMap = new Map<string, Record<string, string>>();
  for (const r of dbRows) {
    const p = extractProps(r);
    const nome = (p["Nome"] || "").trim().toLowerCase();
    if (nome) dbMap.set(nome, p);
  }

  return MEMBROS_IDS.map((m) => {
    const extra = dbMap.get(m.nome.toLowerCase()) || {};
    return {
      notion_id: m.id,
      nome: m.nome,
      cargo: extra["Cargo"] || m.cargo,
      funcoes: extra["Funções"] || "",
      email: extra["Email"] || "",
      telefone: extra["Telefone"] || "",
      status: extra["Status"] || "Ativo",
      drive: extra["DRIVE"] || "",
    };
  });
}

export interface Cliente {
  notion_id: string; nome: string; status: string; situacao: string;
  resultados: string; atencao: string; nicho: string; analista: string;
  plataformas: string; orcamento: string; dia_otimizacao: string;
  ultimo_feedback: string; ultima_otimizacao: string;
  [key: string]: string;
}

export async function getClientes(): Promise<Cliente[]> {
  const rows = await queryAllPages(DB_IDS.clientes);
  return rows.map((r) => {
    const p = extractProps(r);
    return {
      notion_id: r.id as string,
      nome: p["Cliente"] || p["Name"] || p["Nome"] || "",
      status: p["Status"] || "",
      situacao: p["Situação"] || "",
      resultados: p["Resultados"] || "",
      atencao: p["Atenção"] || "",
      nicho: p["Nicho"] || "",
      analista: p["Analista"] || "",
      plataformas: [p["FB"], p["Gads"], p["TikTok"]].filter(Boolean).length > 0
        ? [p["FB"] ? "Meta" : "", p["Gads"] ? "Google" : "", p["TikTok"] ? "TikTok" : ""].filter(Boolean).join(", ")
        : "",
      orcamento: p["Orçamento"] || "",
      dia_otimizacao: p["Dia de otimizar"] || "",
      ultimo_feedback: p["Último Feedback"] || "",
      ultima_otimizacao: p["Otimização"] || "",
      pagamento: p["Pagamento"] || "",
      automacao: p["Automação"] || "",
      fb: p["FB"] || "", gads: p["Gads"] || "", tiktok: p["TikTok"] || "",
      ...p,
    };
  }).filter((c) => c.nome);
}

export async function getClienteById(notionId: string): Promise<Cliente | null> {
  if (!NOTION_KEY) return null;
  try {
    const res = await fetch(`${API}/pages/${notionId}`, { headers: HEADERS, next: { revalidate: 60 } } as RequestInit);
    if (!res.ok) return null;
    const row = await res.json();
    const p = extractProps(row);
    return {
      notion_id: row.id, nome: p["Cliente"] || p["Name"] || "",
      status: p["Status"] || "", situacao: p["Situação"] || "",
      resultados: p["Resultados"] || "", atencao: p["Atenção"] || "",
      nicho: p["Nicho"] || "", analista: p["Analista"] || "",
      plataformas: [p["FB"] ? "Meta" : "", p["Gads"] ? "Google" : "", p["TikTok"] ? "TikTok" : ""].filter(Boolean).join(", "),
      orcamento: p["Orçamento"] || "", dia_otimizacao: p["Dia de otimizar"] || "",
      ultimo_feedback: p["Último Feedback"] || "", ultima_otimizacao: p["Otimização"] || "",
      pagamento: p["Pagamento"] || "", automacao: p["Automação"] || "",
      fb: p["FB"] || "", gads: p["Gads"] || "", tiktok: p["TikTok"] || "",
      ...p,
    };
  } catch { return null; }
}

export async function getClientesByAnalista(nome: string): Promise<Cliente[]> {
  const all = await getClientes();
  return all.filter((c) => c.analista.toLowerCase().includes(nome.toLowerCase()));
}

export interface OnboardingItem {
  notion_id: string; nome: string; etapa: string; plataformas: string;
  orcamento: string; gestor: string;
  [key: string]: string;
}

export async function getOnboarding(): Promise<OnboardingItem[]> {
  const rows = await queryAllPages(DB_IDS.onboarding);
  return rows.map((r) => {
    const p = extractProps(r);
    return {
      notion_id: r.id as string,
      nome: p["Nome"] || p["Name"] || "",
      etapa: p["Etapas"] || p["Etapa"] || "",
      plataformas: p["Plataformas"] || "",
      orcamento: p["Orçamento mensal"] || "",
      gestor: p["Gestor de Tráfego"] || "",
      gestor_junior: p["Gestor Junior"] || "",
      head: p["Head de tráfego"] || "",
      comercial: p["Comercial"] || "",
      sucesso: p["Sucesso do Cliente"] || "",
      produto: p["Produto"] || "",
      ...p,
    };
  }).filter((o) => o.nome);
}

export async function getOnboardingById(notionId: string): Promise<OnboardingItem | null> {
  if (!NOTION_KEY) return null;
  try {
    const res = await fetch(`${API}/pages/${notionId}`, { headers: HEADERS, next: { revalidate: 60 } } as RequestInit);
    if (!res.ok) return null;
    const row = await res.json();
    const p = extractProps(row);
    return {
      notion_id: row.id, nome: p["Nome"] || p["Name"] || "",
      etapa: p["Etapas"] || p["Etapa"] || "",
      plataformas: p["Plataformas"] || "", orcamento: p["Orçamento mensal"] || "",
      gestor: p["Gestor de Tráfego"] || "", gestor_junior: p["Gestor Junior"] || "",
      head: p["Head de tráfego"] || "", comercial: p["Comercial"] || "",
      sucesso: p["Sucesso do Cliente"] || "", produto: p["Produto"] || "",
      ...p,
    };
  } catch { return null; }
}

export interface NotionBlock {
  id: string; type: string; has_children: boolean;
  [key: string]: unknown;
}

export interface Tarefa {
  notion_id: string; nome: string; status: string; data: string;
  responsaveis: string; solicitante: string;
}

export async function getTarefas(): Promise<Tarefa[]> {
  const rows = await queryAllPages(DB_IDS.tarefas);
  return rows.map((r) => {
    const p = extractProps(r);
    return {
      notion_id: r.id as string,
      nome: p["Name"] || p["Nome"] || "",
      status: p["Status"] || "",
      data: p["Data de vencimento"] || "",
      responsaveis: p["Responsáveis"] || "",
      solicitante: p["Solicitante"] || "",
    };
  }).filter((t) => t.nome);
}

export async function getTarefasByPessoa(nome: string): Promise<Tarefa[]> {
  const all = await getTarefas();
  const nomeLower = nome.toLowerCase().trim();
  return all.filter((t) => t.responsaveis.toLowerCase().includes(nomeLower));
}

export interface Reuniao {
  notion_id: string; nome: string; data: string; tipo: string; participantes: string;
}

export async function getReunioes(): Promise<Reuniao[]> {
  const rows = await queryAllPages(DB_IDS.reunioes);
  return rows.map((r) => {
    const p = extractProps(r);
    return {
      notion_id: r.id as string,
      nome: p["Name"] || "",
      data: p["Data"] || "",
      tipo: p["Tipo"] || "",
      participantes: p["Participantes"] || "",
    };
  }).filter((r) => r.nome);
}

export async function getReunioesByPessoa(nome: string): Promise<Reuniao[]> {
  const all = await getReunioes();
  const nomeLower = nome.toLowerCase().trim();
  return all.filter((r) => r.participantes.toLowerCase().includes(nomeLower));
}

export async function getPageContent(notionId: string): Promise<NotionBlock[]> {
  if (!NOTION_KEY) return [];
  const all: NotionBlock[] = [];
  let cursor: string | undefined;
  while (true) {
    const url = `${API}/blocks/${notionId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 120 } } as RequestInit);
    if (!res.ok) break;
    const data = await res.json();
    all.push(...data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return all;
}
