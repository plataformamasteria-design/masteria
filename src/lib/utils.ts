import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { subHours, differenceInMilliseconds } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Checks if a given date is within the last 24 hours.
 * @param date The date to check (can be a Date object or a string).
 * @returns True if the date is within the last 24 hours, false otherwise.
 */
export function is24HourWindowOpen(date: Date | string): boolean {
  if (!date) return false;
  const messageDate = new Date(date);
  const twentyFourHoursAgo = subHours(new Date(), 24);
  return messageDate > twentyFourHoursAgo;
}

/**
 * Calculates the milliseconds left until 24 hours have passed since the given date.
 * @param date The start date (can be a Date object or a string).
 * @returns The number of milliseconds remaining, or 0 if the window has passed.
 */
export function getMillisecondsLeft(date: Date | string): number {
  if (!date) return 0;
  const messageDate = new Date(date);
  const twentyFourHoursLater = new Date(messageDate.getTime() + (24 * 60 * 60 * 1000));
  const now = new Date();
  const diff = differenceInMilliseconds(twentyFourHoursLater, now);
  return Math.max(0, diff);
}


/**
 * Formats the remaining milliseconds into a hh:mm:ss or mm:ss string.
 * @param milliseconds The remaining time in milliseconds.
 * @returns A formatted string representing the time left.
 */
export function formatTimeLeft(milliseconds: number | null): string {
  if (milliseconds === null || milliseconds <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const paddedHours = String(hours).padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}


/**
 * Limpa e padroniza um número de telefone para o formato E.164.
 * @param input O número de telefone a ser processado.
 * @returns O número padronizado ou nulo se a entrada for inválida.
 */
export function sanitizePhone(input: unknown): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  // Remove tudo que não for dígito
  const digitsOnly = String(input).replace(/\D/g, '');

  if (!digitsOnly) {
    return null;
  }

  return `+${digitsOnly}`;
}


/**
 * Cria a versão canônica de um número de telefone brasileiro, adicionando o 9º dígito quando aplicável.
 * Este é o formato que DEVE ser salvo no banco de dados.
 * Também remove duplicações do código de país (55).
 * @param phone O número de telefone sanitizado em E.164 (ex: +5511987654321 ou +551187654321).
 * @returns O número de telefone no formato canônico (+55DDD9...).
 */
export function canonicalizeBrazilPhone(phone: string): string {
  const sanitized = sanitizePhone(phone); // Garante que começa com + e só tem dígitos
  if (!sanitized) return phone; // Retorna original em caso de erro

  let normalized = sanitized;

  // Remove duplicações iterativamente do código de país brasileiro (55)
  // Números brasileiros válidos: +55 (país) + DDD (2) + número (8-9 dígitos)
  // Comprimento máximo válido: 14 caracteres (+55 + 2 DDD + 9 + 8 dígitos)
  //
  // Loop para remover TODOS os "55" duplicados enquanto length > 14
  // Exemplos:
  // - +555564... (16 chars) → +5564... (14 chars)
  // - +555555... (16 chars) → +5555... (14 chars) preserva DDD 55
  // - +55555555... (18 chars) → +5555... (14 chars) múltiplas duplicações
  while (normalized.startsWith('+55') && normalized.length > 14) {
    // Remove os caracteres nas posições 3-4 (um bloco "55" duplicado)
    normalized = '+55' + normalized.substring(5);

    // Safety: Evita loop infinito se algo der errado
    if (!normalized.startsWith('+55') || normalized.length < 12) break;
  }

  // Verifica se é um número de celular brasileiro (+55) com DDD >= 11
  // e adiciona o 9º dígito se necessário
  if (normalized.startsWith('+55') && normalized.length >= 12) {
    const ddd = normalized.substring(3, 5);
    const dddNum = parseInt(ddd, 10);

    // Apenas para celulares (DDD >= 11) e dentro do comprimento esperado
    if (dddNum >= 11) {
      // Se tem 14 caracteres, já tem o 9º dígito
      if (normalized.length === 14) {
        return normalized;
      }
      // Se tem 13 caracteres, VERIFICA se é celular (começa com 6, 7, 8 ou 9 após DDD)
      // Números fixos (começam com 2, 3, 4, 5) NÃO devem receber o 9
      if (normalized.length === 13) {
        const firstDigitAfterDDD = normalized.charAt(5);
        // Celulares brasileiros: começam com 9 (padrão atual), ou 6/7/8 (antigos, alguns ainda existem)
        // Mas a regra do 9º dígito se aplica apenas a números que DEVERIAM ter 9 na frente
        // Se já começa com 9, OK. Se começa com 6/7/8, pode ser celular antigo.
        // Se começa com 2/3/4/5, é FIXO - não adicionar 9!
        const isLikelyMobile = ['6', '7', '8', '9'].includes(firstDigitAfterDDD);
        if (isLikelyMobile) {
          return `${normalized.slice(0, 5)}9${normalized.slice(5)}`;
        }
        // É um número fixo - retornar sem modificar
        return normalized;
      }
    }
  }

  // Para todos os outros casos (números fixos, não-Brasil, etc.), retorna como está
  return normalized;
}


/**
 * Gera as variações de um número de telefone brasileiro (com e sem o 9º dígito) para busca.
 * @param phone O número de telefone sanitizado no formato E.164.
 * @returns Um array com as variações do número.
 */
export function getPhoneVariations(phone: string): string[] {
  const sanitized = sanitizePhone(phone);
  if (!sanitized) return [];

  const variations = new Set([sanitized]);

  // Also add variation WITHOUT '+' prefix to find legacy contacts
  if (sanitized.startsWith('+')) {
    variations.add(sanitized.substring(1));
  }

  // Verifica se é um celular brasileiro (+55) com DDD >= 11
  if (sanitized.startsWith('+55') && parseInt(sanitized.substring(3, 5), 10) >= 11) {
    // Se tem 14 caracteres, significa que tem o 9º dígito (ex: +55119...)
    if (sanitized.length === 14 && sanitized.charAt(5) === '9') {
      const phoneWithoutNine = `${sanitized.slice(0, 5)}${sanitized.slice(6)}`;
      variations.add(phoneWithoutNine);
      // Also without + for legacy
      variations.add(phoneWithoutNine.substring(1));
    }
    // Se tem 13 caracteres, não tem o 9º dígito (ex: +5511...)
    else if (sanitized.length === 13) {
      const phoneWithNine = `${sanitized.slice(0, 5)}9${sanitized.slice(5)}`;
      variations.add(phoneWithNine);
      // Also without + for legacy
      variations.add(phoneWithNine.substring(1));
    }
  }

  return Array.from(variations);
}
