import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().optional(),
  usuario: z.string().min(1).optional(),
  senha: z.string().min(6).max(200),
}).refine((d) => d.email || d.usuario, {
  message: "email ou usuario obrigatório",
});

export const cadastroSchema = z.object({
  nome: z.string().min(2).max(100),
  email: z.string().email(),
  senha: z.string().min(8).max(200),
  cargo: z.string().min(1),
  telefone: z.string().optional(),
  data_inicio: z.string().optional(),
  cpf: z.string().optional(),
  endereco: z.string().optional(),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipo_conta: z.string().optional(),
  pix: z.string().optional(),
  observacoes: z.string().optional(),
});

export const trocarSenhaSchema = z.object({
  nova_senha: z.string().min(6).max(200),
});
