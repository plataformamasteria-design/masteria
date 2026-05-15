/**
 * @deprecated 2026-05-03 — Camada Notion DESLIGADA (P28).
 * Re-exports mantidos para compatibilidade com consumers legados.
 * Novos consumers devem usar Supabase diretamente (clientes_receita, team_notion_mirror).
 * Backup original: docs/backups/desligar-notion/
 *
 * Antigo: Camada de abstracao — todas as paginas importam daqui.
 * Fase 1: Notion. Fase 3: trocar para supabase-read/write.
 */

// @deprecated — Notion read functions (retornam [] sem NOTION_KEY)
export { getTeam, getClientes, getClienteById, getClientesByAnalista, getOnboarding, getOnboardingById, getTarefas, getTarefasByPessoa, getReunioes, getReunioesByPessoa, getPageContent, DB_IDS } from "./notion";
export type { TeamMember, Cliente, OnboardingItem, NotionBlock, Tarefa, Reuniao } from "./notion";

// @deprecated — Notion write functions (retornam { success: false } sem NOTION_KEY)
export {
  updateClienteStatus, updateClienteSituacao, updateClienteResultados,
  updateClienteAtencao, updateClienteOrcamento, updateClienteAnalista,
  updateClienteUltimoFeedback, updateClienteOtimizacao, updateClienteDiaOtimizar,
  addOtimizacaoEntry,
  updateOnboardingEtapa, toggleChecklistItem, updateMembroFuncoes, forceSync,
} from "./notion-write";
