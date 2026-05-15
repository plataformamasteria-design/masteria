import { z } from "zod";

export const criarCampanhaSchema = z.object({
  name: z.string().min(1, "Nome da campanha obrigatório"),
  objective: z.string().min(1, "Objetivo obrigatório"),
  adsets: z.array(z.object({
    name: z.string().min(1),
    ads: z.array(z.object({
      name: z.string().min(1),
      page_id: z.string().min(1),
    }).passthrough()).min(1, "Ao menos 1 anúncio por conjunto"),
  }).passthrough()).min(1, "Ao menos 1 conjunto"),
}).passthrough();

export const editarBudgetSchema = z.object({
  objeto_id: z.string().min(1, "objeto_id obrigatório"),
  tipo: z.enum(["campaign", "adset"]),
  daily_budget: z.number().min(0).max(1_000_000).optional(),
  lifetime_budget: z.number().min(0).max(10_000_000).optional(),
}).refine(
  (d) => d.daily_budget !== undefined || d.lifetime_budget !== undefined,
  { message: "daily_budget ou lifetime_budget obrigatório" }
);
