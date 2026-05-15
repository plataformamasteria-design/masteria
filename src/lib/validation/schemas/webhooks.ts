import { z } from "zod";

// GHL envia payloads variados — schema permissivo com .passthrough()
// Garante apenas que é um objeto com campos mínimos esperados
export const ghlWebhookSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    opportunity_id: z.string().optional(),
    contactId: z.string().optional(),
    contact_id: z.string().optional(),
  })
  .passthrough()
  .refine(
    (d) => d.id || d.opportunity_id || d.contactId || d.contact_id,
    { message: "Payload deve conter ao menos um identificador (id, opportunity_id ou contactId)" }
  );

// Asaas envia evento + payment
export const asaasWebhookSchema = z
  .object({
    event: z.string().min(1, "event obrigatório"),
    payment: z
      .object({
        id: z.string().min(1),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
