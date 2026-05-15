/**
 * Tipagens centrais do módulo de métricas de vídeo Meta Ads.
 * Sem dependências externas — apenas tipos TypeScript puros.
 */

/** Ação retornada pela Meta API (ex: video_play_actions, video_p25_watched_actions) */
export interface MetaActionValue {
  action_type: string;
  value: string;
}

/** Dados brutos de insights retornados pela Meta Marketing API */
export interface RawMetaInsight {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  objective: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  spend: string;
  video_play_actions?: MetaActionValue[];
  video_p25_watched_actions?: MetaActionValue[];
  video_p50_watched_actions?: MetaActionValue[];
  video_p75_watched_actions?: MetaActionValue[];
  video_p100_watched_actions?: MetaActionValue[];
  video_30_sec_watched_actions?: MetaActionValue[];
  video_thruplay_watched_actions?: MetaActionValue[];
  video_avg_time_watched_actions?: MetaActionValue[];
  /** Campos opcionais de placement breakdown */
  publisher_platform?: string;
  platform_position?: string;
}

/** Dados de criativos retornados pela Meta API */
export interface RawMetaCreative {
  id: string;
  name: string;
  status: string;
  created_time: string;
  thumbnail_url?: string;
  video_id?: string;
}

/** Métricas calculadas a partir dos dados brutos */
export interface CalculatedMetrics {
  /** (video_p25_watched / impressions) * 100 — proxy 3s views / impressões */
  hookRate: number;
  /** (video_30_sec_watched / video_play_actions) * 100 — retenção após 30s */
  holdRate: number;
  /** (thruplays / impressions) * 100 — taxa de conclusão sobre impressões */
  completionRate: number;
  /** (video_p25 / impressions) * 100 */
  p25Rate: number;
  /** (video_p50 / impressions) * 100 */
  p50Rate: number;
  /** (video_p75 / impressions) * 100 */
  p75Rate: number;
  /** (video_p100 / impressions) * 100 */
  p100Rate: number;
  /** spend / video_thruplay_watched */
  costPerThruPlay: number;
  /** Tempo médio assistido em segundos */
  avgTimeWatched: number;
  /** Total de plays (video_play_actions) */
  totalPlays: number;
  /** Total de thru-plays */
  totalThruPlays: number;
}

/** Score calculado para um criativo com label e cor semântica */
export interface CreativeScore {
  /** Score de 0 a 100 */
  score: number;
  /** Label legível */
  label: "Excelente" | "Bom" | "Atenção" | "Crítico";
  /** Cor para UI */
  color: "green" | "blue" | "yellow" | "red";
}

/** Direção da tendência de um criativo */
export type CreativeTrend = "subindo" | "estável" | "caindo";

/** Status de fadiga de um criativo */
export type FatigueStatus = "saudável" | "atenção" | "em_fadiga" | "fadiga_crítica";

/** Grupo de placement normalizado */
export type PlacementGroup =
  | "Feed Facebook"
  | "Reels Facebook"
  | "Feed Instagram"
  | "Reels Instagram"
  | "Stories Instagram"
  | "Outro";

/** Estágio do funil baseado no objetivo da campanha */
export type FunnelStage = "Topo" | "Meio" | "Fundo";

/** Métrica diária para análise de tendência e fadiga */
export interface DailyMetric {
  date: string;
  hookRate: number;
  adName: string;
}

/** Criativo completo com todas as métricas, score, fadiga e tendência */
export interface CreativeWithMetrics {
  /** Dados do criativo */
  id: string;
  name: string;
  status: string;
  campaignName: string;
  thumbnailUrl?: string;
  /** Métricas calculadas */
  metrics: CalculatedMetrics;
  /** Score do criativo */
  score: CreativeScore;
  /** Status de fadiga */
  fatigue: FatigueStatus;
  /** Tendência recente */
  trend: CreativeTrend;
  /** Investimento total */
  spend: number;
  /** Impressões totais */
  impressions: number;
}
