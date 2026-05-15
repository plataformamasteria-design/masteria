// GHL Pipeline and Stage IDs
// Extracted from GHL API on 2026-04-02

export const GHL_PIPELINES = {
  lucas: {
    id: "ZjrMXF5XMBSCZOorLeu8",
    name: "Closer - Lucas",
    stages: {
      reuniao_agendada: "ed4bfe56-4276-4cb5-9e43-0b78642e3c58",
      proposta_enviada: "97aea69e-0e81-42cf-b0ed-7d22df6e4fc1",
      ligacao: "f49e9862-f768-4525-8d13-192becf7392f",
      follow_up: "84bdd5f8-5f77-4409-b8b0-3d6e4a0c0ad2",
      assinatura_contrato: "ab26cacc-831c-4a7b-a7b3-0833ddeb0e9e",
      comprou: "13d7e2bd-ace1-4c7a-95cd-61bc3307aaf7",
      desistiu: "1d0d7e32-b76c-4eca-96f6-d667d4ba1b7d",
    },
  },
  mariana: {
    id: "ENg4tFVzJsUh8rHRntAX",
    name: "Closer - Mariana",
    stages: {
      reuniao_agendada: "2af7cd37-888f-4ac5-aebb-4684ec1ffcdb",
      proposta_enviada: "90f88779-be1b-4548-9c96-7aefd5789ab0",
      ligacao: "97d5ebd5-cce8-4029-b4e2-e60268c4c71f",
      follow_up: "2e253669-4176-4ed8-9a99-54f91fbbbc98",
      assinatura_contrato: "eaf29531-7d40-439f-a45f-695bccfb0b7e",
      comprou: "21e0439b-9d43-4ab1-8185-ec496fe89924",
      desistiu: "d42845f1-04c3-416b-8da3-2209268deaf2",
    },
  },
  rogerio: {
    id: "8B7pjhZ4jv0e4u3JjtsR",
    name: "Closer - Rogerio",
    stages: {
      reuniao_agendada: "29d40407-3294-4289-8e99-1d42ff0529b9",
      proposta_enviada: "3a98961b-f332-4ebe-9945-b272e851b447",
      ligacao: "90a30a56-b13a-41b2-b183-04c4a739ffc0",
      follow_up: "a9c2c9aa-2a6b-4f5b-83cd-1c27ac8b546a",
      assinatura_contrato: "877bf292-bf66-42e1-8238-ace13de55e65",
      comprou: "bae00043-c0e3-45e9-918e-cce85a05df13",
      desistiu: "804d183d-4cc0-4f4a-8859-be2a101e7cb8",
    },
  },
} as const;

// Closer ID (Supabase) → Pipeline ID (GHL)
export const CLOSER_PIPELINE_MAP: Record<string, string> = {
  "a987d655-88d0-490b-ad73-efe04843a2ec": GHL_PIPELINES.lucas.id,
  "9b3edc8c-e5ce-450a-95b9-742f3c5c23b1": GHL_PIPELINES.mariana.id,
  "c8a5b749-b313-432e-ab4e-55bce924ec88": GHL_PIPELINES.rogerio.id,
};

/**
 * @deprecated Use ghl_user_map (tipo='closer') instead.
 * Mantido como fallback até validação completa.
 * Remover após: backfill de closers + 0 fallbacks por 30 dias.
 * Ver: pipeline_closer_map_fallback_log para monitoramento.
 */
export const PIPELINE_CLOSER_MAP: Record<string, string> = {
  [GHL_PIPELINES.lucas.id]: "a987d655-88d0-490b-ad73-efe04843a2ec",
  [GHL_PIPELINES.mariana.id]: "9b3edc8c-e5ce-450a-95b9-742f3c5c23b1",
  [GHL_PIPELINES.rogerio.id]: "c8a5b749-b313-432e-ab4e-55bce924ec88",
};

// Get GHL stage ID for a closer + etapa
export function getGhlStageId(closerId: string, etapa: string): string | null {
  const pipelineId = CLOSER_PIPELINE_MAP[closerId];
  if (!pipelineId) return null;

  const closer = Object.values(GHL_PIPELINES).find((p) => p.id === pipelineId);
  if (!closer) return null;

  return (closer.stages as Record<string, string>)[etapa] || null;
}

// GHL Stage name → internal etapa
export const GHL_STAGE_MAP: Record<string, string> = {
  "Reunião agendada": "reuniao_agendada",
  "Proposta enviada": "proposta_enviada",
  "Ligação": "follow_up",
  "follow up": "follow_up",
  "Follow Up": "follow_up",
  "Contrato": "assinatura_contrato",
  "Comprou": "comprou",
  "Desistiu": "desistiu",
};
