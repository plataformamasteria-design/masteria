/**
 * Normalização de telefone para matching.
 * Remove tudo exceto dígitos, retorna apenas os dígitos.
 * O banco (telefone_normalizado) guarda COM código país (ex: 5575992642038).
 * Para comparar, extraímos os últimos 10-11 dígitos (DDD + número sem país).
 */

export function normalizarTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

/**
 * Extrai DDD + número sem código país.
 * "5571987670007" → "71987670007"
 * "71987670007" → "71987670007"
 */
export function telefoneParaComparacao(telefone: string | null | undefined): string | null {
  const digits = normalizarTelefone(telefone);
  if (!digits) return null;
  // Remover código país 55 se presente
  if (digits.length >= 12 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  if (digits.length >= 10 && digits.length <= 11) {
    return digits;
  }
  return digits.slice(-11);
}

/**
 * Extrai DDD + 8 últimos dígitos do número (ignora nono dígito).
 * Resolve discrepância entre GHL (sem 9) e Meta (com 9):
 *   GHL: "7187670007" → DDD=71 + 87670007 (8 dígitos)
 *   Meta: "71987670007" → DDD=71 + 87670007 (ignora o 9)
 * Retorna string de 10 dígitos: DDD (2) + últimos 8 do número.
 */
export function telefoneSem9(telefone: string | null | undefined): string | null {
  const semPais = telefoneParaComparacao(telefone);
  if (!semPais) return null;
  const ddd = semPais.slice(0, 2);
  const numero = semPais.slice(2); // 8 ou 9 dígitos
  // Pegar últimos 8 dígitos (ignora o 9 extra se presente)
  const ultimos8 = numero.slice(-8);
  if (ultimos8.length < 8) return null;
  return ddd + ultimos8;
}

/**
 * Compara dois telefones independente do formato e do nono dígito.
 */
export function telefonesIguais(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = telefoneSem9(a);
  const nb = telefoneSem9(b);
  if (!na || !nb) return false;
  return na === nb;
}
