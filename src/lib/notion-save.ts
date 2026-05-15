/**
 * @deprecated 2026-05-03 — Notion Save DESLIGADO (P28).
 * saveToNotion() retorna { success: false } quando NOTION_API_KEY ausente.
 * Backup original: docs/backups/desligar-notion/
 */
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = "1aa6db14-b3cd-44f2-a938-893fcc362e98";
const NOTION_API = "https://api.notion.com/v1";

type IAOrigem = "Claude" | "ChatGPT" | "Gemini" | "Perplexity" | "n8n" | "Outra";
type Tipo = "Performance" | "Estrategia" | "Copy" | "Analise" | "Operacional" | "Insights";
type Relevancia = "Alta" | "Media" | "Baixa";

interface NotionSaveParams {
  titulo: string;
  iaOrigem: IAOrigem;
  tipo: Tipo;
  tags: string[];
  relevancia: Relevancia;
  resumo: string;
  conteudo: string;
}

function textBlock(text: string) {
  // Split into chunks of 2000 chars (Notion limit per block)
  const chunks: { type: string; paragraph: { rich_text: { type: string; text: { content: string } }[] } }[] = [];
  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    if ((current + "\n" + line).length > 1900) {
      if (current) chunks.push({ type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: current } }] } });
      current = line;
    } else {
      current = current ? current + "\n" + line : line;
    }
  }
  if (current) chunks.push({ type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: current } }] } });

  return chunks;
}

export async function saveToNotion(params: NotionSaveParams): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!NOTION_API_KEY) {
    return { success: false, error: "NOTION_API_KEY not configured" };
  }

  const today = new Date().toISOString().split("T")[0];

  const properties: Record<string, unknown> = {
    "Titulo": { title: [{ text: { content: params.titulo } }] },
    "IA Origem": { select: { name: params.iaOrigem } },
    "Tipo": { select: { name: params.tipo } },
    "Tags": { multi_select: params.tags.map((t) => ({ name: t })) },
    "Data": { date: { start: today } },
    "Status": { select: { name: "Novo" } },
    "Relevancia": { select: { name: params.relevancia } },
    "Resumo": { rich_text: [{ text: { content: params.resumo.slice(0, 2000) } }] },
  };

  const children = textBlock(params.conteudo);

  try {
    const res = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties,
        children: children.slice(0, 100), // Notion max 100 blocks per request
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Notion] Save failed:", err);
      return { success: false, error: `Notion API error: ${res.status}` };
    }

    const data = await res.json();
    return { success: true, url: data.url };
  } catch (e) {
    console.error("[Notion] Save error:", e);
    // Retry once
    try {
      const res = await fetch(`${NOTION_API}/pages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_API_KEY}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties,
          children: children.slice(0, 100),
        }),
      });
      if (!res.ok) return { success: false, error: `Notion retry failed: ${res.status}` };
      const data = await res.json();
      return { success: true, url: data.url };
    } catch (e2) {
      return { success: false, error: String(e2) };
    }
  }
}

// Helper to map AI provider to IA Origem
export function providerToOrigem(provider: string): IAOrigem {
  if (provider.startsWith("anthropic")) return "Claude";
  if (provider.startsWith("openai")) return "ChatGPT";
  if (provider === "gemini") return "Gemini";
  return "Outra";
}
