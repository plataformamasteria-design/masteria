/**
 * tree-utils.ts
 * Utilitários compartilhados entre CriarCampanhaDrawer e DuplicarCampanhaDrawer.
 * Converte payload bruto da Meta Graph API em CampaignNodeTree compatível com o TreeBuilder.
 */

import type { CampaignNodeTree, AdSetNode, AdNode } from "./tree-builder";

interface CampaignMeta {
  id: string;
  name: string;
  objective: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
}

/**
 * Constrói uma CampaignNodeTree editável a partir dos dados brutos da Meta API.
 * Usado tanto na duplicação via CriarCampanhaDrawer quanto no DuplicarCampanhaDrawer.
 */
export function buildInitialTreeFromMeta(
  campaignMeta: CampaignMeta,
  adsetsData: Record<string, unknown>[]
): CampaignNodeTree {
  const adsets: AdSetNode[] = adsetsData.map((asRaw) => {
    const as = asRaw as Record<string, any>;
    const ads: AdNode[] = (as.ads?.data || []).map((ad: Record<string, any>) => ({
      id: `ad_${Math.random().toString(36).substr(2, 9)}`,
      metaId: ad.id,
      name: ad.name || "Anúncio",
      page_id: ad.creative?.object_story_spec?.page_id || ad.creative?.page_id || "",
      instagram_actor_id: ad.creative?.object_story_spec?.instagram_actor_id || ad.creative?.instagram_actor_id || "",
      creative_source: "MANUAL" as const,
      format: "SINGLE_IMAGE" as const,
      copy:
        ad.creative?.object_story_spec?.link_data?.message ||
        ad.creative?.object_story_spec?.video_data?.message ||
        "",
      headline:
        ad.creative?.object_story_spec?.link_data?.name ||
        ad.creative?.object_story_spec?.video_data?.title ||
        "",
      description:
        ad.creative?.object_story_spec?.link_data?.description || "",
      caption: "",
      image_hash: "",
      image_url:
        ad.creative?.thumbnail_url || ad.creative?.image_url || "",
      video_id: ad.creative?.video_id || "",
      carousel_cards: [],
      url:
        ad.creative?.object_story_spec?.link_data?.link || "",
      url_tags: "",
      cta_type:
        ad.creative?.object_story_spec?.link_data?.call_to_action?.type ||
        "LEARN_MORE",
      multi_advertiser: false,
      advantage_creative: false,
      message_template_id: "",
      greeting_text: "",
      ice_breakers: [{ title: "" }, { title: "" }],
    }));

    const targeting = as.targeting || {};
    const geoLoc = targeting.geo_locations?.countries || ["BR"];
    const ageMin = String(targeting.age_min || 18);
    const ageMax = String(targeting.age_max || 65);
    const genders =
      targeting.genders?.[0] === 1
        ? "MALE"
        : targeting.genders?.[0] === 2
        ? "FEMALE"
        : "ALL";

    const localId = `adset_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: localId,
      metaId: as.id,
      name: as.name || "Conjunto",
      daily_budget: as.daily_budget
        ? String(Math.round(as.daily_budget))
        : "20",
      lifetime_budget: as.lifetime_budget
        ? String(Math.round(as.lifetime_budget))
        : "350",
      budget_type: as.lifetime_budget ? "LIFETIME" : "DAILY",
      bid_amount: "",
      bid_strategy: as.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
      roas_average_floor: "",
      dynamic_creative: false,
      start_time: as.start_time ? as.start_time.slice(0, 16) : "",
      end_time: as.end_time ? as.end_time.slice(0, 16) : "",
      optimization_goal: as.optimization_goal || "",
      geo_locations: geoLoc,
      geo_locations_advanced: [],
      age_min: ageMin,
      age_max: ageMax,
      genders,
      custom_audiences: targeting.custom_audiences || [],
      excluded_custom_audiences: targeting.excluded_custom_audiences || [],
      interests:
        (targeting.flexible_spec?.[0]?.interests as Record<string, any>[])?.map((i) => ({
          id: i.id as string,
          name: i.name as string,
        })) || [],
      behaviors:
        (targeting.flexible_spec?.[0]?.behaviors as Record<string, any>[])?.map((b) => ({
          id: b.id as string,
          name: b.name as string,
        })) || [],
      life_events: [],
      work_positions: [],
      excluded_interests: [],
      excluded_behaviors: [],
      education_statuses: [],
      relationship_statuses: [],
      placements_type: targeting.publisher_platforms ? "MANUAL" : "ADVANTAGE",
      device_platforms: targeting.device_platforms || ["mobile", "desktop"],
      publisher_platforms: targeting.publisher_platforms || [
        "facebook",
        "instagram",
      ],
      facebook_positions: targeting.facebook_positions || ["feed", "story"],
      instagram_positions: targeting.instagram_positions || [
        "stream",
        "story",
      ],
      messenger_positions: targeting.messenger_positions || [],
      audience_network_positions: [],
      conversion_location:
        as.destination_type && as.destination_type !== "WEBSITE"
          ? "MESSAGING_APP"
          : as.optimization_goal === "CONVERSATIONS"
          ? "MESSAGING_APP"
          : "WEBSITE",
      messaging_destinations: as.promoted_object?.whatsapp_phone_number || as.promoted_object?.whatsapp_number || as.destination_type === "WHATSAPP"
        ? ["whatsapp", "instagram"]
        : as.destination_type === "MESSENGER" || as.destination_type === "INSTAGRAM_DIRECT"
        ? [as.destination_type.toLowerCase().replace("_direct", "")]
        : as.optimization_goal === "CONVERSATIONS" ? ["whatsapp", "instagram"] : [],
      pixel_id: as.promoted_object?.pixel_id || "",
      custom_event_type: as.promoted_object?.custom_event_type || "PURCHASE",
      advantage_audience: 1,
      ads,
    };
  });

  const fallbackAdSet: AdSetNode = {
    id: "adset_fallback",
    name: "Público Aberto",
    daily_budget: "20",
    lifetime_budget: "350",
    budget_type: "DAILY",
    bid_amount: "",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    roas_average_floor: "",
    dynamic_creative: false,
    start_time: "",
    end_time: "",
    optimization_goal: "",
    geo_locations: ["BR"],
    geo_locations_advanced: [],
    age_min: "18",
    age_max: "65",
    genders: "ALL",
    custom_audiences: [],
    excluded_custom_audiences: [],
    interests: [],
    behaviors: [],
    life_events: [],
    work_positions: [],
    excluded_interests: [],
    excluded_behaviors: [],
    education_statuses: [],
    relationship_statuses: [],
    placements_type: "ADVANTAGE",
    device_platforms: ["mobile", "desktop"],
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed", "story"],
    instagram_positions: ["stream", "story"],
    messenger_positions: [],
    audience_network_positions: [],
    conversion_location: "WEBSITE",
    messaging_destinations: [],
    pixel_id: "",
    custom_event_type: "PURCHASE",
    advantage_audience: 1,
    ads: [],
  };

  return {
    name: `${campaignMeta.name} — Cópia`,
    objective: campaignMeta.objective || "OUTCOME_TRAFFIC",
    special_ad_categories: "NONE",
    buying_type: "AUCTION",
    is_cbo: !!campaignMeta.daily_budget,
    daily_budget: campaignMeta.daily_budget
      ? String(Math.round(campaignMeta.daily_budget))
      : "50",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    spend_cap: "",
    start_active: false,
    adsets: adsets.length > 0 ? adsets : [fallbackAdSet],
    metaCampaignId: undefined,
  };
}
