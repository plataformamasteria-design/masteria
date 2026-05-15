import type { ConfirmarVendaForm } from "./types";

export type FormErrors = Partial<Record<keyof ConfirmarVendaForm, string>>;

export function validarCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

export function validarCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * w1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (d1 !== parseInt(digits[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * w2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return d2 === parseInt(digits[13]);
}

export function validateForm(form: ConfirmarVendaForm): FormErrors {
  const errors: FormErrors = {};

  // Seção 1
  if (!form.nome.trim()) errors.nome = "Nome é obrigatório";

  const whatsDigits = form.whatsapp.replace(/\D/g, "");
  if (whatsDigits.length < 10) errors.whatsapp = "WhatsApp inválido (mínimo 10 dígitos)";

  if (!form.pf_pj) errors.pf_pj = "Tipo de pessoa é obrigatório";

  if (!form.tipo_documento) {
    errors.tipo_documento = "Tipo de documento é obrigatório";
  } else {
    const docDigits = form.cpf_cnpj_numero.replace(/\D/g, "");
    if (!docDigits) {
      errors.cpf_cnpj_numero = "Documento é obrigatório";
    } else if (form.tipo_documento === "CPF") {
      if (!validarCPF(docDigits)) errors.cpf_cnpj_numero = "CPF inválido";
    } else if (form.tipo_documento === "CNPJ") {
      if (!validarCNPJ(docDigits)) errors.cpf_cnpj_numero = "CNPJ inválido";
    }
  }

  // Seção 2
  if (!form.mrr || form.mrr <= 0) errors.mrr = "MRR deve ser maior que 0";
  if (!form.meses_contrato && form.meses_contrato !== 0) errors.meses_contrato = "Meses de contrato é obrigatório";
  if (!form.forma_pagamento) errors.forma_pagamento = "Forma de pagamento é obrigatória";
  if (!form.modelo_contrato) errors.modelo_contrato = "Modelo de contrato é obrigatório";

  // Seção 3 — se tem entrada
  if (form.valor_entrada > 0) {
    if (form.sinal_valor <= 0 && !form.restante_data_prevista) {
      errors.sinal_valor = "Preencha o sinal ou a data prevista do restante";
    }
  }

  return errors;
}

export function getSectionCompletion(form: ConfirmarVendaForm): boolean[] {
  // Section 1: nome, whatsapp, pf_pj, cpf_cnpj ok
  const s1 =
    !!form.nome.trim() &&
    form.whatsapp.replace(/\D/g, "").length >= 10 &&
    !!form.pf_pj &&
    !!form.cpf_cnpj_numero.replace(/\D/g, "");

  // Section 2: mrr, meses_contrato, forma_pagamento, modelo_contrato
  const s2 =
    form.mrr > 0 &&
    !!form.meses_contrato &&
    !!form.forma_pagamento &&
    !!form.modelo_contrato;

  // Section 3: only required if entrada > 0
  const s3 =
    form.valor_entrada <= 0 ||
    form.sinal_valor > 0 ||
    !!form.restante_data_prevista;

  // Section 4: origem
  const s4 = !!form.origem;

  return [s1, s2, s3, s4];
}

// ── Masks ──
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function maskCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
