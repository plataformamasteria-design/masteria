/**
 * Meta Marketing API — Write Layer
 * Operações de criação e edição de campanhas, conjuntos, anúncios, criativos e públicos.
 * Server-side only — importar apenas em API routes.
 * API version: v21.0
 */

const TOKEN = () => process.env.META_ADS_ACCESS_TOKEN || "";
/** Retorna o account ID SEM prefixo act_ para uso interno.
 *  As funções adicionam act_ ao montar as URLs.
 *  Se a variável de ambiente já contiver act_, o prefixo é removido para evitar act_act_.
 */
const ACCOUNT = () => {
  const raw = process.env.META_ADS_ACCOUNT_ID || "";
  return raw.startsWith("act_") ? raw.slice(4) : raw;
};
const BASE = "https://graph.facebook.com/v21.0";


// ============ TYPES ============

export type CampaignObjective =
  | "OUTCOME_LEADS"
  | "OUTCOME_SALES"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_APP_PROMOTION";

export type ObjectStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";

export type BidStrategy =
  | "LOWEST_COST_WITHOUT_CAP"
  | "LOWEST_COST_WITH_BID_CAP"
  | "COST_CAP"
  | "MINIMUM_ROAS";

export type OptimizationGoal =
  | "LEAD_GENERATION"
  | "LINK_CLICKS"
  | "IMPRESSIONS"
  | "REACH"
  | "CONVERSATIONS"
  | "LANDING_PAGE_VIEWS"
  | "THRUPLAY"
  | "TWO_SECOND_CONTINUOUS_VIDEO_VIEWS"
  | "OFFSITE_CONVERSIONS"
  | "REPLIES"
  | "POST_ENGAGEMENT"
  | "PAGE_LIKES"
  | "APP_INSTALLS"
  | "VALUE"
  | "VISIT_INSTAGRAM_PROFILE";

export type BillingEvent = "IMPRESSIONS" | "LINK_CLICKS" | "THRUPLAY";

export type AudienceSubtype =
  | "CUSTOM"
  | "WEBSITE"
  | "APP"
  | "LOOKALIKE"
  | "ENGAGEMENT"
  | "COMBINATION"
  | "IG_BUSINESS"
  | "VIDEO";

export interface GeoLocation {
  countries?: string[];
  cities?: { key: string; name: string }[];
  regions?: { key: string; name: string }[];
}

export interface TargetingSpec {
  age_min?: number;
  age_max?: number;
  genders?: (1 | 2)[];
  geo_locations: GeoLocation;
  interests?: { id: string; name: string }[];
  behaviors?: { id: string; name: string }[];
  custom_audiences?: { id: string }[];
  excluded_custom_audiences?: { id: string }[];
  publisher_platforms?: ("facebook" | "instagram" | "audience_network" | "messenger")[];
  flexible_spec?: Array<{
    interests?: { id: string; name: string }[];
    behaviors?: { id: string; name: string }[];
  }>;
  exclusions?: {
    interests?: { id: string; name: string }[];
    behaviors?: { id: string; name: string }[];
  };
  education_statuses?: number[];
  relationship_statuses?: number[];
  life_events?: { id: string; name: string }[];
  work_positions?: { id: string; name: string }[];
}

export interface CreateCampaignParams {
  name: string;
  objective: CampaignObjective;
  status: ObjectStatus;
  special_ad_categories?: string[];
  daily_budget?: number; // em centavos
  lifetime_budget?: number; // em centavos
  start_time?: string;
  stop_time?: string;
  buying_type?: "AUCTION" | "RESERVED";
  is_adset_budget_sharing_enabled?: boolean;
  bid_strategy?: BidStrategy;
  spend_cap?: number; // centavos
}

export interface CreateAdSetParams {
  name: string;
  campaign_id: string;
  status: ObjectStatus;
  daily_budget?: number; // centavos BRL
  lifetime_budget?: number;
  start_time?: string;
  end_time?: string;
  optimization_goal: OptimizationGoal;
  billing_event: BillingEvent;
  bid_strategy: BidStrategy;
  bid_amount?: number;
  targeting: TargetingSpec;
  promoted_object?: {
    pixel_id?: string;
    custom_event_type?: string;
    page_id?: string;
    instagram_profile_id?: string;
    whatsapp_phone_number_id?: string;
  };
  destination_type?: string; // Valid values: WEBSITE, MESSAGING_APP, APP, MESSENGER, INSTAGRAM_DIRECT, MESSAGING_MESSENGER_WHATSAPP, MESSAGING_INSTAGRAM_DIRECT_MESSENGER, MESSAGING_INSTAGRAM_DIRECT_WHATSAPP, MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP
  compliance_section?: Record<string, unknown>;
}

export type LinkData = {
  link: string;
  message: string;
  name?: string;
  description?: string;
  image_hash?: string;
  call_to_action?: { type: string; value?: { link?: string } };
};

export type VideoData = {
  video_id: string;
  message: string;
  title?: string;
  image_url?: string;
  call_to_action?: { type: string; value?: { link?: string } };
};

export type ObjectStorySpec =
  | { page_id: string; instagram_actor_id?: string; link_data: LinkData }
  | { page_id: string; instagram_actor_id?: string; video_data: VideoData };

export interface CreateCreativeParams {
  name: string;
  object_story_spec: ObjectStorySpec;
}

export interface CreateAdParams {
  name: string;
  adset_id: string;
  creative_id: string;
  status: ObjectStatus;
  url_tags?: string;
}

export interface CreateCustomAudienceParams {
  name: string;
  subtype: AudienceSubtype;
  description?: string;
  customer_file_source?: "USER_PROVIDED_ONLY";
  rule?: any;
  prefill?: boolean;
  retention_days?: number;
  lookalike_spec?: {
    origin: { id: string; type?: string }[];
    type?: string;
    ratio: number;
    starting_ratio?: number;
    location_spec?: {
      geo_locations: { countries: string[] };
    };
  };
}

// ============ INTERNAL HELPERS ============

export interface MetaWriteResult<T = Record<string, unknown>> {
  data?: T;
  error?: string;
  status?: number;
}

async function metaPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<MetaWriteResult<T>> {
  const token = TOKEN();
  if (!token) return { error: "META_ADS_ACCESS_TOKEN não configurado", status: 500 };
  const url = `${BASE}/${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, access_token: token }),
    });
    const json = await res.json();
    if (!res.ok) {
      const metaErr = json?.error;
      const detail = metaErr?.error_user_msg || metaErr?.message || `Meta API ${res.status}`;
      const subcode = metaErr?.error_subcode ? ` [subcode:${metaErr.error_subcode}]` : "";
      console.error("[meta-write] API error:", JSON.stringify(metaErr));
      return { error: `${detail}${subcode}`, status: res.status };
    }

    return { data: json as T };
  } catch (e) {
    return { error: String(e), status: 500 };
  }
}

async function metaGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<MetaWriteResult<T>> {
  const token = TOKEN();
  if (!token) return { error: "META_ADS_ACCESS_TOKEN não configurado", status: 500 };
  const qs = new URLSearchParams({ ...params, access_token: token });
  try {
    const res = await fetch(`${BASE}/${path}?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error?.message || `Meta API ${res.status}`, status: res.status };
    return { data: json as T };
  } catch (e) {
    return { error: String(e), status: 500 };
  }
}

// ============ CAMPAIGNS ============

export interface CampaignResponse { id: string; name: string; status: string }

export async function createCampaign(params: CreateCampaignParams): Promise<MetaWriteResult<CampaignResponse>> {
  const account = ACCOUNT();
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  const body: Record<string, unknown> = {
    name: params.name,
    objective: params.objective,
    status: params.status,
    special_ad_categories: params.special_ad_categories || [],
  };
  if (params.buying_type) body.buying_type = params.buying_type;
  if (params.is_adset_budget_sharing_enabled !== undefined) body.is_adset_budget_sharing_enabled = params.is_adset_budget_sharing_enabled;
  if (params.daily_budget) body.daily_budget = String(params.daily_budget);
  if (params.lifetime_budget) body.lifetime_budget = String(params.lifetime_budget);
  if (params.spend_cap) body.spend_cap = String(params.spend_cap);
  if (params.bid_strategy) body.bid_strategy = params.bid_strategy;
  
  if (params.start_time) body.start_time = params.start_time;
  if (params.stop_time) body.stop_time = params.stop_time;
  return metaPost<CampaignResponse>(`act_${account}/campaigns`, body);
}

export interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  start_time?: string;
  stop_time?: string;
  buying_type?: string;
  effective_status?: string;
  created_time?: string;
}

// ============ AUDIENCES & TARGETING ============

export async function getCustomAudiences(): Promise<MetaWriteResult<{ data: { id: string; name: string; approximate_count_upper_bound?: number; subtype?: string; operation_status?: { code: number; description: string } }[] }>> {
  const account = ACCOUNT();
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  return metaGet(`act_${account}/customaudiences`, { fields: "id,name,approximate_count_upper_bound,subtype,operation_status", limit: "500" });
}

export async function listCampaigns(): Promise<MetaWriteResult<{ data: CampaignDetail[] }>> {
  const account = ACCOUNT();
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  return metaGet<{ data: CampaignDetail[] }>(`act_${account}/campaigns`, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,buying_type,effective_status,created_time",
    limit: "500",
  });
}

// ============ AD SETS ============

export interface AdSetResponse { id: string; name: string; status: string }

export async function createAdSet(params: CreateAdSetParams): Promise<MetaWriteResult<AdSetResponse>> {
  const account = ACCOUNT();
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  const body: Record<string, unknown> = {
    name: params.name,
    campaign_id: params.campaign_id,
    status: params.status,
    optimization_goal: params.optimization_goal,
    billing_event: params.billing_event,
    bid_strategy: params.bid_strategy,
    targeting: params.targeting,
  };
  if (params.daily_budget) body.daily_budget = String(params.daily_budget);
  if (params.lifetime_budget) body.lifetime_budget = String(params.lifetime_budget);
  if (params.bid_amount) body.bid_amount = String(params.bid_amount);
  if (params.start_time) body.start_time = params.start_time;
  if (params.end_time) body.end_time = params.end_time;
  if (params.promoted_object) body.promoted_object = params.promoted_object;
  if (params.destination_type) body.destination_type = params.destination_type;
  if (params.compliance_section) body.compliance_section = params.compliance_section;
  return metaPost<AdSetResponse>(`act_${account}/adsets`, body);
}

// ============ CREATIVES ============

export interface CreativeResponse { id: string; name: string }

export async function createCreative(params: CreateCreativeParams): Promise<MetaWriteResult<CreativeResponse>> {
  const account = ACCOUNT();
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  return metaPost<CreativeResponse>(`act_${account}/adcreatives`, {
    name: params.name,
    object_story_spec: params.object_story_spec,
  });
}

// ============ ADS ============

export interface AdResponse { id: string; name: string; status: string }

export async function createAd(params: CreateAdParams): Promise<MetaWriteResult<AdResponse>> {
  const account = ACCOUNT();
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  
  const body: Record<string, unknown> = {
    name: params.name,
    adset_id: params.adset_id,
    creative: { creative_id: params.creative_id },
    status: params.status,
  };
  if (params.url_tags) body.url_tags = params.url_tags;

  return metaPost<AdResponse>(`act_${account}/ads`, body);
}

// ============ STATUS UPDATE ============

export async function updateStatus(
  objectId: string,
  status: ObjectStatus,
): Promise<MetaWriteResult<{ success: boolean }>> {
  return metaPost<{ success: boolean }>(objectId, { status });
}

// ============ BUDGET UPDATE ============

export async function updateBudget(
  objectId: string,
  opts: { daily_budget?: number; lifetime_budget?: number },
): Promise<MetaWriteResult<{ success: boolean }>> {
  const body: Record<string, string> = {};
  if (opts.daily_budget !== undefined) body.daily_budget = String(opts.daily_budget);
  if (opts.lifetime_budget !== undefined) body.lifetime_budget = String(opts.lifetime_budget);
  return metaPost<{ success: boolean }>(objectId, body);
}

// ============ DUPLICATE ============

export interface DuplicateResponse { copies: { id: string }[] }

export async function duplicateObject(
  objectId: string,
  opts: { status_option?: "PAUSED" | "ACTIVE" | "INHERITED_FROM_SOURCE"; deep_copy?: boolean } = {},
): Promise<MetaWriteResult<DuplicateResponse>> {
  return metaPost<DuplicateResponse>(`${objectId}/copies`, {
    status_option: opts.status_option || "PAUSED",
    deep_copy: opts.deep_copy ?? false,
  });
}

// ============ DELIVERY STATUS ============

export interface DeliveryIssue {
  id: string;
  error_code: string;
  error_message: string;
  level: string;
}

export interface DeliveryInfo {
  id: string;
  name: string;
  status: string;
  delivery_status?: { value: string; delivery_desks: { value: string }[] };
  issues_info?: DeliveryIssue[];
}

export async function getDeliveryStatus(objectId: string): Promise<MetaWriteResult<DeliveryInfo>> {
  return metaGet<DeliveryInfo>(objectId, { fields: "id,name,status,delivery_status,issues_info" });
}

// ============ MEDIA LIBRARY ============

export interface MetaVideo {
  id: string;
  title?: string;
  length?: number;
  thumbnails?: { data: { uri: string }[] };
  status?: { processing_progress: number; video_status: string };
  created_time?: string;
}

export interface MetaImage {
  hash: string;
  name: string;
  url: string;
  url_128?: string;
  created_time?: string;
}

export async function listVideos(): Promise<MetaWriteResult<{ data: MetaVideo[] }>> {
  const account = ACCOUNT();
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  return metaGet<{ data: MetaVideo[] }>(`act_${account}/advideos`, {
    fields: "id,title,length,thumbnails,status,created_time",
    limit: "100",
  });
}

export async function listImages(): Promise<MetaWriteResult<{ data: MetaImage[] }>> {
  const account = ACCOUNT();
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  return metaGet<{ data: MetaImage[] }>(`act_${account}/adimages`, {
    fields: "hash,name,url,url_128,created_time",
    limit: "200",
  });
}

// ============ PAGES ============

export interface FacebookPage {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: { id: string; name: string; username: string };
}

export async function listPages(): Promise<MetaWriteResult<{ data: FacebookPage[] }>> {
  return metaGet<{ data: FacebookPage[] }>("me/accounts", {
    fields: "id,name,instagram_business_account{id,name,username},instagram_accounts{id,username}",
    limit: "50",
  });
}

// ============ CUSTOM AUDIENCES ============

export interface CustomAudience {
  id: string;
  name: string;
  subtype: string;
  approximate_count_upper_bound?: number;
  data_source?: { type: string };
  delivery_status?: { code: number; description: string };
  description?: string;
  lookalike_spec?: {
    country: string;
    ratio: number;
    origin: { id: string; name: string }[];
  };
}

export async function listCustomAudiences(accountOverride?: string): Promise<MetaWriteResult<{ data: CustomAudience[] }>> {
  const raw = accountOverride || process.env.META_ADS_ACCOUNT_ID || "";
  const account = raw.startsWith("act_") ? raw.slice(4) : raw;
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  return metaGet<{ data: CustomAudience[] }>(`act_${account}/customaudiences`, {
    fields: "id,name,rule,subtype,approximate_count_upper_bound,data_source,delivery_status,description,lookalike_spec",
    limit: "500",
  });
}

export interface AudienceCreateResponse { id: string; name: string }

export async function createCustomAudience(
  params: CreateCustomAudienceParams,
  accountOverride?: string
): Promise<MetaWriteResult<AudienceCreateResponse>> {
  const raw = accountOverride || process.env.META_ADS_ACCOUNT_ID || "";
  const account = raw.startsWith("act_") ? raw.slice(4) : raw;
  if (!account) return { error: "META_ADS_ACCOUNT_ID não configurado", status: 500 };
  const body: Record<string, unknown> = { name: params.name, subtype: params.subtype };
  if (params.description) body.description = params.description;
  if (params.customer_file_source) body.customer_file_source = params.customer_file_source;
  if (params.rule) body.rule = params.rule;
  if (params.prefill !== undefined) body.prefill = params.prefill;
  if (params.retention_days) body.retention_days = params.retention_days;
  if (params.lookalike_spec) body.lookalike_spec = params.lookalike_spec;

  return metaPost<AudienceCreateResponse>(`act_${account}/customaudiences`, body);
}

export async function addEmailsToAudience(
  audienceId: string,
  emails: string[],
): Promise<MetaWriteResult<{ num_received: number; num_invalid_entries: number }>> {
  return metaPost(`${audienceId}/users`, {
    payload: { schema: ["EMAIL"], data: emails.map((e) => e.toLowerCase().trim()) },
  });
}

// ============ INTEREST SEARCH ============

export interface InterestItem {
  id: string;
  name: string;
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  path?: string[];
  description?: string;
  topic?: string;
}

export async function searchInterests(query: string): Promise<MetaWriteResult<{ data: InterestItem[] }>> {
  const token = TOKEN();
  if (!token) return { error: "META_ADS_ACCESS_TOKEN não configurado", status: 500 };
  const qs = new URLSearchParams({ type: "adinterest", q: query, locale: "pt_BR", access_token: token });
  try {
    const res = await fetch(`${BASE}/search?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error?.message || `Meta API ${res.status}`, status: res.status };
    return { data: json };
  } catch (e) {
    return { error: String(e), status: 500 };
  }
}

export async function searchBehaviors(query: string): Promise<MetaWriteResult<{ data: InterestItem[] }>> {
  const token = TOKEN();
  if (!token) return { error: "META_ADS_ACCESS_TOKEN não configurado", status: 500 };
  const qs = new URLSearchParams({ type: "adbehavior", q: query, locale: "pt_BR", access_token: token });
  try {
    const res = await fetch(`${BASE}/search?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error?.message || `Meta API ${res.status}`, status: res.status };
    return { data: json };
  } catch (e) {
    return { error: String(e), status: 500 };
  }
}

/** Busca categorias de targeting demográfico (educação, relacionamento, eventos de vida, cargos).
 *  Sem query: retorna todas as categorias da classe passada.
 *  Com query: filtra pelo nome.
 */
export async function searchDemographics(
  query?: string,
  cls: "demographics" | "life_events" | "work" | "education" = "demographics",
): Promise<MetaWriteResult<{ data: InterestItem[] }>> {
  const token = TOKEN();
  if (!token) return { error: "META_ADS_ACCESS_TOKEN não configurado", status: 500 };
  const params: Record<string, string> = { type: "adTargetingCategory", class: cls, locale: "pt_BR", access_token: token };
  if (query) params.q = query;
  const qs = new URLSearchParams(params);
  try {
    const res = await fetch(`${BASE}/search?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error?.message || `Meta API ${res.status}`, status: res.status };
    return { data: json };
  } catch (e) {
    return { error: String(e), status: 500 };
  }
}

// ============ LOCATION SEARCH ============

export interface LocationItem {
  key: string;
  name: string;
  type: string;
  country_code?: string;
  country_name?: string;
  region?: string;
  region_id?: number | string;
  supports_region?: boolean;
  supports_city?: boolean;
}

export async function searchLocations(query: string): Promise<MetaWriteResult<{ data: LocationItem[] }>> {
  const token = TOKEN();
  if (!token) return { error: "META_ADS_ACCESS_TOKEN não configurado", status: 500 };
  // A Meta usa type=adgeolocation para busca de localidades (países, estados, cidades, ceps)
  const qs = new URLSearchParams({ type: "adgeolocation", q: query, locale: "pt_BR", access_token: token });
  try {
    const res = await fetch(`${BASE}/search?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error?.message || `Meta API ${res.status}`, status: res.status };
    return { data: json };
  } catch (e) {
    return { error: String(e), status: 500 };
  }
}

// ============ REACH ESTIMATE ============

export interface ReachEstimate {
  estimate_ready: boolean;
  users_lower_bound: number;
  users_upper_bound: number;
}

export async function estimateReach(targeting: TargetingSpec): Promise<MetaWriteResult<ReachEstimate>> {
  const account = ACCOUNT();
  const token = TOKEN();
  if (!account || !token) return { error: "Credenciais Meta não configuradas", status: 500 };
  const qs = new URLSearchParams({
    targeting_spec: JSON.stringify(targeting),
    optimization_goal: "LEAD_GENERATION",
    access_token: token,
  });
  try {
    const res = await fetch(`${BASE}/act_${account}/reachestimate?${qs.toString()}`);
    const json = await res.json();
    if (!res.ok) return { error: json?.error?.message || `Meta API ${res.status}`, status: res.status };
    return { data: json?.data?.[0] ?? json };
  } catch (e) {
    return { error: String(e), status: 500 };
  }
}
