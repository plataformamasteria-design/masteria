/**
 * @deprecated 2026-05-03 — Notion Write Layer DESLIGADO (P28).
 * Todas as funcoes retornam { success: false } quando NOTION_KEY esta ausente.
 * Escrita no Notion nao acontece mais. Arquivo mantido para referencia.
 * Backup original: docs/backups/desligar-notion/
 */
"use server";

import { revalidateTag } from "next/cache";
import { DB_IDS } from "./notion";

const NOTION_KEY = process.env.NOTION_API_KEY || "";
const API = "https://api.notion.com/v1";
const HEADERS = {
  Authorization: `Bearer ${NOTION_KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

async function patchPage(pageId: string, properties: Record<string, unknown>, dbId?: string): Promise<{ success: boolean; error?: string }> {
  if (!NOTION_KEY) return { success: false, error: "NOTION_API_KEY not set" };
  try {
    const res = await fetch(`${API}/pages/${pageId}`, {
      method: "PATCH", headers: HEADERS, body: JSON.stringify({ properties }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Notion ${res.status}: ${err.slice(0, 200)}` };
    }
    if (dbId) revalidateTag(dbId);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// === Cliente Updates ===

export async function updateClienteStatus(notionId: string, value: string) {
  return patchPage(notionId, { Status: { select: { name: value } } }, DB_IDS.clientes);
}
export async function updateClienteSituacao(notionId: string, value: string) {
  return patchPage(notionId, { "Situação": { select: { name: value } } }, DB_IDS.clientes);
}
export async function updateClienteResultados(notionId: string, value: string) {
  return patchPage(notionId, { Resultados: { select: { name: value } } }, DB_IDS.clientes);
}
export async function updateClienteAtencao(notionId: string, value: string) {
  return patchPage(notionId, { "Atenção": { select: { name: value } } }, DB_IDS.clientes);
}
export async function updateClienteOrcamento(notionId: string, value: number) {
  return patchPage(notionId, { "Orçamento": { number: value } }, DB_IDS.clientes);
}
export async function updateClienteAnalista(notionId: string, userId: string) {
  return patchPage(notionId, { "Analista": { people: [{ id: userId }] } }, DB_IDS.clientes);
}
export async function updateClienteUltimoFeedback(notionId: string, dateIso: string) {
  return patchPage(notionId, { "Último Feedback": { date: { start: dateIso } } }, DB_IDS.clientes);
}
export async function updateClienteOtimizacao(notionId: string, dateIso: string) {
  return patchPage(notionId, { "Otimização": { date: { start: dateIso } } }, DB_IDS.clientes);
}
export async function updateClienteDiaOtimizar(notionId: string, value: string) {
  return patchPage(notionId, { "Dia de otimizar": { select: { name: value } } }, DB_IDS.clientes);
}

export async function addOtimizacaoEntry(notionId: string, entry: {
  data: string; comentarios: string; feito: string; proximaVez: string; solicitado: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!NOTION_KEY) return { success: false, error: "NOTION_API_KEY not set" };
  const content = `📅 ${entry.data}\n💬 Comentários: ${entry.comentarios}\n✅ Feito: ${entry.feito}\n🔄 Próxima vez: ${entry.proximaVez}\n📋 Solicitado: ${entry.solicitado}`;
  try {
    const res = await fetch(`${API}/blocks/${notionId}/children`, {
      method: "PATCH", headers: HEADERS,
      body: JSON.stringify({
        children: [{
          type: "toggle", toggle: {
            rich_text: [{ type: "text", text: { content: `Otimização ${entry.data}` } }],
            children: [{ type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content } }] } }],
          },
        }],
      }),
    });
    if (!res.ok) return { success: false, error: `Notion ${res.status}` };
    revalidateTag(DB_IDS.clientes);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// === Onboarding Updates ===

export async function updateOnboardingEtapa(notionId: string, value: string) {
  return patchPage(notionId, { Etapas: { status: { name: value } } }, DB_IDS.onboarding);
}

export async function toggleChecklistItem(blockId: string, checked: boolean): Promise<{ success: boolean; error?: string }> {
  if (!NOTION_KEY) return { success: false, error: "NOTION_API_KEY not set" };
  try {
    const res = await fetch(`${API}/blocks/${blockId}`, {
      method: "PATCH", headers: HEADERS,
      body: JSON.stringify({ to_do: { checked } }),
    });
    if (!res.ok) return { success: false, error: `Notion ${res.status}` };
    revalidateTag(DB_IDS.onboarding);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// === Team Updates ===

export async function updateMembroFuncoes(notionId: string, funcoes: string) {
  return patchPage(notionId, { "Funções": { rich_text: [{ text: { content: funcoes } }] } }, DB_IDS.team);
}

// === Force Sync ===

export async function forceSync(dbId: string) {
  revalidateTag(dbId);
  return { success: true };
}
