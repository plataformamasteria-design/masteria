import type { AIProvider } from "./ai-client";

export const AI_CONFIG: Record<string, AIProvider> = {
  diagnostico_alerta: "anthropic-haiku",
  analise_closer: "anthropic-haiku",
  relatorio_semanal: "gemini",
  resumo_executivo: "openai-mini",
  analisar_escala: "anthropic-haiku",
  avaliar_alerta_trafego: "gemini",
  diagnostico_ads: "anthropic-haiku",
  diagnostico_auto: "anthropic-haiku",
  relatorio_trafego: "anthropic-haiku",
  copy_intelligence: "gemini",
  radar_analise: "gemini",
  resumo_reuniao: "anthropic-haiku",
  analise_whatsapp: "anthropic-haiku",
  gerar_mensagem: "anthropic-haiku",
  projecoes_ai: "anthropic-haiku",
  plano_semanal: "gemini",
};

export type AIFunction = keyof typeof AI_CONFIG;

export const AI_LABELS: Record<AIProvider, { nome: string; custo: string; custoEstimado: string; custoInput: string; custoOutput: string }> = {
  "gemini": { nome: "Gemini Flash", custo: "mais barato", custoEstimado: "~$0 (free tier)", custoInput: "$0", custoOutput: "$0" },
  "openai-mini": { nome: "GPT-4o Mini", custo: "barato", custoEstimado: "~$0.01/análise", custoInput: "$0.15/1M", custoOutput: "$0.60/1M" },
  "anthropic-haiku": { nome: "Claude Haiku", custo: "moderado", custoEstimado: "~$0.02/análise", custoInput: "$0.25/1M", custoOutput: "$1.25/1M" },
  "anthropic": { nome: "Claude Sonnet", custo: "premium", custoEstimado: "~$0.05/análise", custoInput: "$3.00/1M", custoOutput: "$15.00/1M" },
  "openai": { nome: "GPT-4o", custo: "premium", custoEstimado: "~$0.05/análise", custoInput: "$2.50/1M", custoOutput: "$10.00/1M" },
};

export const AI_FUNCTION_LABELS: Record<string, { nome: string; descricao: string; rota: string; maxTokens: number }> = {
  diagnostico_alerta: { nome: "Diagnóstico de Alertas", descricao: "Avalia severidade e causa de alertas de performance de tráfego", rota: "/api/alerta-diagnostico", maxTokens: 1000 },
  analise_closer: { nome: "Análise de Closer", descricao: "Diagnóstico de performance individual com plano de ação semanal", rota: "/api/closer-analysis", maxTokens: 2000 },
  relatorio_semanal: { nome: "Relatório Semanal", descricao: "Resumo semanal do cliente com performance e próximos passos", rota: "/api/clientes/resumo-semanal", maxTokens: 2000 },
  resumo_executivo: { nome: "Resumo Executivo", descricao: "Resumo condensado para apresentação a stakeholders", rota: "/api/clientes/resumo-semanal", maxTokens: 1500 },
  analisar_escala: { nome: "Análise de Escala", descricao: "Identifica campanhas para escalar, pausar e redistribuir budget (máx 25%/dia)", rota: "/api/ia/analisar-escala", maxTokens: 1500 },
  avaliar_alerta_trafego: { nome: "Avaliar Alerta de Tráfego", descricao: "Avalia alerta com regras, histórico e ciclo de vida do criativo", rota: "/api/ia/avaliar-alerta-trafego", maxTokens: 1000 },
  diagnostico_ads: { nome: "Diagnóstico de Ads", descricao: "Análise completa multi-anúncio com funil de atribuição", rota: "/api/ad-intelligence/diagnostico", maxTokens: 2000 },
  diagnostico_auto: { nome: "Diagnóstico Automático", descricao: "Scoring rápido de criativos para alertas automáticos", rota: "/api/ad-intelligence/diagnostico-auto", maxTokens: 300 },
  relatorio_trafego: { nome: "Relatório de Tráfego", descricao: "Relatório formatado com top criativos e recomendações", rota: "/api/ad-intelligence/relatorio", maxTokens: 3000 },
  copy_intelligence: { nome: "Copy Intelligence", descricao: "Análise de copy + geração de variações A/B para anúncios", rota: "/api/marketing/copy-intelligence", maxTokens: 3000 },
  radar_analise: { nome: "Radar de Análise", descricao: "Resumo rápido do período com ação prioritária", rota: "/api/ia/radar-analise", maxTokens: 300 },
  resumo_reuniao: { nome: "Resumo de Reunião", descricao: "Resume reunião com pontos, decisões, próximos passos e alertas", rota: "/api/clientes/resumo-reuniao", maxTokens: 2000 },
  analise_whatsapp: { nome: "Análise WhatsApp", descricao: "Análise de grupo WhatsApp: satisfação, oportunidades, alertas", rota: "/api/demanda/analise-ia", maxTokens: 2048 },
  gerar_mensagem: { nome: "Gerar Mensagem", descricao: "Gera mensagem estratégica para grupo WhatsApp do cliente", rota: "/api/demanda/gerar-mensagem", maxTokens: 800 },
  projecoes_ai: { nome: "Projeções Estratégicas", descricao: "Análise completa COO com diagnóstico de funil e plano de ação top 7", rota: "/api/projections/ai", maxTokens: 4000 },
  plano_semanal: { nome: "Plano Semanal", descricao: "Gera plano semanal estratégico com prioridades e metas", rota: "/api/plano-semanal", maxTokens: 2000 },
};

export const ALL_PROVIDERS: AIProvider[] = ["gemini", "openai-mini", "anthropic-haiku", "anthropic", "openai"];

export function getAIProvider(fn: string): AIProvider {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`ai_provider_${fn}`);
    if (saved && ALL_PROVIDERS.includes(saved as AIProvider)) return saved as AIProvider;
  }
  return (AI_CONFIG[fn] as AIProvider) || "anthropic-haiku";
}

export function setAIProvider(fn: string, provider: AIProvider) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`ai_provider_${fn}`, provider);
  }
}

// Prompts do sistema — editáveis via localStorage
const DEFAULT_PROMPTS: Record<string, string> = {
  diagnostico_alerta: `Você é um analista sênior de mídia paga especializado em campanhas para advogados. Diagnostique alertas de performance com base em dados históricos. Analise TODAS as métricas em conjunto, considere tendência e volume, diferencie problema real de variação natural.`,
  analise_closer: `Você é um especialista em performance comercial de agências de marketing digital focadas no nicho jurídico. Analise os dados de performance do closer e forneça:
1. DIAGNÓSTICO: 2-3 parágrafos explicando padrão de performance
2. CAUSAS PROVÁVEIS: 3-5 causas específicas e realistas
3. PLANO DE AÇÃO: 3 ações práticas para a próxima semana com prazos
Seja direto, específico e orientado a resultado. Evite genericidades.`,
  analisar_escala: `Você é um analista sênior de tráfego pago especializado em Meta Ads para uma agência de marketing digital brasileira.
Analise os dados das campanhas ativas e responda em português do Brasil, de forma direta e acionável.
Use formatação markdown com headers ##.
Sempre use valores em R$ (Real brasileiro).
REGRA DE ESCALA: O aumento máximo de orçamento por dia é de 25% do valor atual. Nunca recomende aumentos maiores que 25% de uma vez.`,
  avaliar_alerta_trafego: `Você é um especialista em Meta Ads para escritórios de advocacia. Avalie o alerta recebido considerando regras de otimização, histórico de 7 dias, score do criativo e fase do ciclo de vida. Retorne JSON com severidade, causa provável e ação recomendada.`,
  diagnostico_ads: `Você é um consultor de tráfego pago especializado no mercado jurídico brasileiro. Responda em português, de forma direta e acionável. Use markdown para formatar.`,
  diagnostico_auto: `Analise os criativos abaixo e retorne um JSON com: critico (1 frase), oportunidade (1 frase), confianca (baseado em N criativos).`,
  relatorio_trafego: `Você é um analista de tráfego pago sênior especializado no mercado jurídico brasileiro. Gere relatórios profissionais em português com markdown. Seja direto e acionável.`,
  copy_intelligence: `Você é um copywriter sênior especializado em Meta Ads para o mercado jurídico. Analise copies de anúncios e gere variações A/B. Mantenha o público-alvo original. Cada variação testa UMA hipótese. Alerte sobre compliance OAB se detectar promessas de resultado.`,
  radar_analise: `Você é um analista sênior de tráfego pago. Analise os dados e retorne APENAS um JSON com:
- "resumo": 2 frases exatamente (máx 120 chars cada)
- "acao": 1 ação prioritária (máx 80 chars)`,
  resumo_reuniao: `Resuma a reunião em português BR de forma estruturada:
**Pontos Discutidos** — principais tópicos
**Decisões Tomadas** — o que ficou definido
**Próximos Passos** — ações com responsáveis
**Alertas** — preocupações ou riscos`,
  relatorio_semanal: `Gere um resumo semanal do cliente em português BR estruturado em:
**Performance** — principais números e tendências
**Reuniões** — o que aconteceu
**Otimizações** — ações e impacto
**Alertas** — pontos críticos
**Próximos Passos** — ações recomendadas`,
  resumo_executivo: `Gere um resumo executivo condensado focado em métricas-chave e decisões pendentes. Máximo 5 parágrafos.`,
  analise_whatsapp: `Você é um especialista em análise de relacionamento comercial e marketing jurídico digital. Analisará mensagens de grupos de WhatsApp de clientes e gerará insights estratégicos acionáveis. SEMPRE responda em JSON válido e puro, sem markdown.`,
  gerar_mensagem: `Você é um especialista em comunicação estratégica para agências de marketing jurídico. Cria mensagens para grupos de WhatsApp de clientes com tom profissional mas próximo.
REGRAS: Formato WhatsApp (sem HTML, *negrito*), use emojis estratégicos, máximo 15 linhas, termine com pergunta ou CTA claro, APENAS a mensagem.`,
  projecoes_ai: `# AGENTE DE PERFORMANCE | AGÊNCIA DE MARKETING JURÍDICO
## IDENTIDADE
Você é o Agente de Performance. Trabalha para a agência, não para o advogado.
## REGRAS INVIOLÁVEIS
1. Zero achismo — toda afirmação ancorada em número real
2. Sem frase genérica — números específicos, ações específicas
3. Formato: O QUE FAZER → POR QUE (dado) → IMPACTO ESPERADO
4. Priorização por dinheiro — o que move mais o ponteiro vem primeiro
5. Visão de agência: custo operacional, margem, retenção, escalabilidade
6. ESCALA: Nunca recomendar aumento de orçamento superior a 25% por dia`,
};

export function getAIPrompt(fn: string): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`ai_prompt_${fn}`);
    if (saved) return saved;
  }
  return DEFAULT_PROMPTS[fn] || "";
}

export function setAIPrompt(fn: string, prompt: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`ai_prompt_${fn}`, prompt);
  }
}

export function resetAIPrompt(fn: string) {
  if (typeof window !== "undefined") {
    localStorage.removeItem(`ai_prompt_${fn}`);
  }
  return DEFAULT_PROMPTS[fn] || "";
}

export function getDefaultPrompt(fn: string): string {
  return DEFAULT_PROMPTS[fn] || "";
}

