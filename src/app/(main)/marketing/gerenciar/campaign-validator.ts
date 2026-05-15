import { AdSetNode, CampaignNodeTree } from "./tree-builder";

export type ValidationError = {
  nodeId: string;
  nodeName: string;
  type: "campaign" | "adset" | "ad";
  message: string;
  level: "error" | "warning";
};

export function validateCampaignTree(tree: CampaignNodeTree, adsets: AdSetNode[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Campaign Level
  if (!tree.name || tree.name.trim().length === 0) {
    errors.push({ nodeId: "root", nodeName: "Campanha Mestre", type: "campaign", message: "O nome da campanha está vazio.", level: "error" });
  }

  if (adsets.length === 0) {
    errors.push({ nodeId: "root", nodeName: "Campanha Mestre", type: "campaign", message: "A campanha não possui nenhum conjunto de anúncios.", level: "error" });
  }

  // AdSet Level
  adsets.forEach((ast) => {
    if (!ast.name || ast.name.trim().length === 0) {
      errors.push({ nodeId: ast.id, nodeName: "Conjunto Desconhecido", type: "adset", message: "O conjunto está sem nome.", level: "error" });
    }

    // Orçamento mínimo real da Meta: R$1,00/dia. Recomendado: R$6,00+
    const budget = parseFloat(ast.budget_type === "LIFETIME" ? ast.lifetime_budget : ast.daily_budget);
    if (!isNaN(budget) && budget < 1) {
      errors.push({ nodeId: ast.id, nodeName: ast.name, type: "adset", message: "O orçamento está abaixo do mínimo da Meta (R$ 1,00/dia).", level: "error" });
    } else if (!isNaN(budget) && budget < 6) {
      errors.push({ nodeId: ast.id, nodeName: ast.name, type: "adset", message: "Orçamento abaixo de R$ 6,00/dia. A entrega pode ser limitada.", level: "warning" });
    }

    // Validação de lance (bid_amount) — obrigatório para certas estratégias
    const bidStrategy = ast.bid_strategy || "LOWEST_COST_WITHOUT_CAP";
    if ((bidStrategy === "LOWEST_COST_WITH_BID_CAP" || bidStrategy === "COST_CAP") && !ast.bid_amount) {
      errors.push({ nodeId: ast.id, nodeName: ast.name, type: "adset", message: `A estratégia "${bidStrategy === "COST_CAP" ? "Teto de Custo" : "Bid Cap"}" exige o campo Valor do Lance preenchido.`, level: "error" });
    }

    // Validação ROAS obrigatório para MINIMUM_ROAS
    if (bidStrategy === "MINIMUM_ROAS" && !ast.roas_average_floor) {
      errors.push({ nodeId: ast.id, nodeName: ast.name, type: "adset", message: "A estratégia ROAS Mínimo exige o campo ROAS preenchido (ex: 1.5).", level: "error" });
    }

    if (ast.ads.length === 0) {
      errors.push({ nodeId: ast.id, nodeName: ast.name, type: "adset", message: "O conjunto não possui anúncios.", level: "error" });
    }
    
    // Ads Level
    ast.ads.forEach((ad) => {
      if (!ad.page_id) {
        errors.push({ nodeId: ad.id, nodeName: ad.name, type: "ad", message: "Página do Facebook não selecionada.", level: "error" });
      }
      if (!ad.instagram_actor_id) {
         errors.push({ nodeId: ad.id, nodeName: ad.name, type: "ad", message: "Perfil do Instagram não selecionado. A vinculação via IG ficará desabilitada.", level: "warning" });
      }

      if (ad.format !== "CAROUSEL") {
        if (!ad.image_hash && !ad.video_id) {
          errors.push({ nodeId: ad.id, nodeName: ad.name, type: "ad", message: "Nenhum arquivo de Mídia (Imagem ou Vídeo) foi selecionado.", level: "error" });
        }
      } else {
        if (ad.carousel_cards.length < 2) {
          errors.push({ nodeId: ad.id, nodeName: ad.name, type: "ad", message: "O formato Carrossel exige ao menos 2 cards.", level: "error" });
        }
        ad.carousel_cards.forEach((card, idx) => {
          if (!card.image_hash) {
            errors.push({ nodeId: ad.id, nodeName: ad.name, type: "ad", message: `O Card ${idx+1} do Carrossel está sem imagem.`, level: "error" });
          }
        });
      }

      // Limites de caracteres recomendados pela Meta
      if ((ad.copy?.length || 0) > 125) {
        errors.push({ nodeId: ad.id, nodeName: ad.name, type: "ad", message: `Texto principal (copy) excede 125 caracteres (atual: ${ad.copy.length}). Pode ser truncado.`, level: "warning" });
      }
      if ((ad.headline?.length || 0) > 40) {
        errors.push({ nodeId: ad.id, nodeName: ad.name, type: "ad", message: `Headline excede 40 caracteres (atual: ${ad.headline?.length}). Pode ser truncado.`, level: "warning" });
      }
      if ((ad.description?.length || 0) > 30) {
        errors.push({ nodeId: ad.id, nodeName: ad.name, type: "ad", message: `Descrição excede 30 caracteres (atual: ${ad.description?.length}). Pode ser truncado.`, level: "warning" });
      }

      if ((ad.cta_type === "SEND_MESSAGE" || ad.cta_type === "SEND_WHATSAPP_MESSAGE") && !ad.message_template_id) {
         errors.push({ nodeId: ad.id, nodeName: ad.name, type: "ad", message: "O CTA é de mensagem, mas nenhum Modelo de Mensagem foi selecionado.", level: "warning" });
      }
    });

    // Validações de localização
    const hasSimpleGeo = ast.geo_locations && ast.geo_locations.length > 0;
    const hasAdvancedGeo = ast.geo_locations_advanced && ast.geo_locations_advanced.length > 0;
    if (!hasSimpleGeo && !hasAdvancedGeo) {
      errors.push({ nodeId: ast.id, nodeName: ast.name, type: "adset", message: "Nenhuma localização definida. Adicione ao menos um país, estado ou cidade.", level: "error" });
    }

    // Pixel obrigatório para objetivo Vendas
    if (ast.conversion_location === "WEBSITE" && !ast.pixel_id) {
      errors.push({ nodeId: ast.id, nodeName: ast.name, type: "adset", message: "Pixel ID obrigatório para campanhas de Site/LP com rastreamento.", level: "warning" });
    }

    // Validação de datas
    if (ast.start_time && ast.end_time) {
      const start = new Date(ast.start_time).getTime();
      const end = new Date(ast.end_time).getTime();
      if (!isNaN(start) && !isNaN(end) && end <= start) {
        errors.push({ nodeId: ast.id, nodeName: ast.name, type: "adset", message: "A data de encerramento deve ser posterior à data de início.", level: "error" });
      }
    }
  });

  return errors;
}
