/**
 * Mapeamento de placements do Meta Ads e estágios de funil.
 * Converte dados brutos da API em grupos legíveis para a dashboard.
 * Funções puras sem dependências externas.
 */

import type { PlacementGroup, FunnelStage } from "./types/metaVideo";

/**
 * Mapeamento de publisher_platform + platform_position → PlacementGroup.
 * Chave: "publisher_platform|platform_position" (lowercase).
 * Editável para adicionar novos placements conforme Meta atualiza.
 */
const PLACEMENT_MAP: Record<string, PlacementGroup> = {
  // Facebook
  "facebook|feed": "Feed Facebook",
  "facebook|feed_unknown": "Feed Facebook",
  "facebook|right_hand_column": "Feed Facebook",
  "facebook|marketplace": "Feed Facebook",
  "facebook|video_feeds": "Feed Facebook",
  "facebook|facebook_reels": "Reels Facebook",
  "facebook|facebook_reels_overlay": "Reels Facebook",
  "facebook|facebook_stories": "Feed Facebook",
  "facebook|instream_video": "Feed Facebook",

  // Instagram
  "instagram|stream": "Feed Instagram",
  "instagram|feed": "Feed Instagram",
  "instagram|profile_feed": "Feed Instagram",
  "instagram|explore": "Feed Instagram",
  "instagram|explore_home": "Feed Instagram",
  "instagram|reels": "Reels Instagram",
  "instagram|ig_reels": "Reels Instagram",
  "instagram|clips": "Reels Instagram",
  "instagram|story": "Stories Instagram",
  "instagram|ig_stories": "Stories Instagram",

  // Audience Network
  "audience_network|classic": "Outro",
  "audience_network|rewarded_video": "Outro",

  // Messenger
  "messenger|messenger_inbox": "Outro",
  "messenger|messenger_stories": "Outro",
};

/**
 * Converte publisher_platform e platform_position em um PlacementGroup legível.
 * Faz lookup no mapeamento normalizado (lowercase).
 * Retorna "Outro" se não encontrar correspondência.
 */
export function mapToPlacementGroup(publisher_platform: string, platform_position: string): PlacementGroup {
  const key = `${(publisher_platform || "").toLowerCase()}|${(platform_position || "").toLowerCase()}`;
  return PLACEMENT_MAP[key] || "Outro";
}

/**
 * Mapeamento de objective da campanha → estágio do funil.
 * Baseado nos objetivos padrão do Meta Ads.
 * Editável para adicionar novos objetivos.
 */
const FUNNEL_MAP: Record<string, FunnelStage> = {
  // Topo de funil — awareness e alcance
  "AWARENESS": "Topo",
  "REACH": "Topo",
  "BRAND_AWARENESS": "Topo",
  "OUTCOME_AWARENESS": "Topo",

  // Meio de funil — consideração e engajamento
  "TRAFFIC": "Meio",
  "ENGAGEMENT": "Meio",
  "VIDEO_VIEWS": "Meio",
  "POST_ENGAGEMENT": "Meio",
  "LINK_CLICKS": "Meio",
  "OUTCOME_ENGAGEMENT": "Meio",
  "OUTCOME_TRAFFIC": "Meio",

  // Fundo de funil — conversão e leads
  "LEAD_GENERATION": "Fundo",
  "CONVERSIONS": "Fundo",
  "MESSAGES": "Fundo",
  "CATALOG_SALES": "Fundo",
  "STORE_VISITS": "Fundo",
  "OUTCOME_LEADS": "Fundo",
  "OUTCOME_SALES": "Fundo",
  "OUTCOME_APP_PROMOTION": "Fundo",
};

/**
 * Converte o objetivo da campanha em um estágio do funil.
 * Normaliza para uppercase antes do lookup.
 * Retorna "Meio" como fallback se o objetivo não for reconhecido.
 */
export function mapToFunnelStage(objective: string): FunnelStage {
  return FUNNEL_MAP[(objective || "").toUpperCase()] || "Meio";
}
