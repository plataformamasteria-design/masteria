/**
 * Normalize phone number to E.164 format
 * @param phone - Phone number in any format
 * @returns Normalized phone number or null if invalid
 */
export function normalizePhone(phone: string): string | null {
  // Remove all non-digit characters except + at the start
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove + from anywhere except the start
  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
  } else {
    cleaned = cleaned.replace(/\+/g, '');
  }
  
  // If it's a JID (WhatsApp ID format), extract the phone number
  if (phone.includes('@')) {
    const parts = phone.split('@');
    if (parts[0]) {
      cleaned = parts[0].replace(/[^\d]/g, '');
    }
  }
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    // If it starts with country code (e.g., 55 for Brazil), add +
    if (cleaned.length >= 10) {
      cleaned = '+' + cleaned;
    } else {
      return null; // Invalid number
    }
  }
  
  // Validate length (E.164 allows 7-15 digits after +)
  const digits = cleaned.substring(1);
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }
  
  return cleaned;
}

/**
 * Check if a WhatsApp JID represents a group chat
 * @param jid - WhatsApp JID (e.g., "123456789@g.us" for group)
 * @returns True if it's a group chat
 */
export function isGroupChat(jid: string): boolean {
  return jid.includes('@g.us');
}

/**
 * Detect if a phone number is a WhatsApp group based on length
 * Groups typically have 18 digits and start with 120363
 * @param phone - Phone number or JID
 * @returns True if it's likely a group
 * @deprecated Use detectGroup() instead for more accurate detection
 */
export function isGroupByPhone(phone: string): boolean {
  if (phone.includes('@g.us')) return true;
  
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.length > 15) {
    return true;
  }
  
  return false;
}

/**
 * Detect if a contact is a WhatsApp group/community using JID-first logic
 * Priority: JID suffixes > number pattern matching
 * @param options - Detection parameters
 * @returns True if it's a group, broadcast, newsletter, or community
 */
export function detectGroup(options: { remoteJid?: string; phone: string }): boolean {
  const { remoteJid, phone } = options;
  
  // 1. JID-based detection (most reliable)
  const jidToCheck = remoteJid || phone;
  const jidLower = jidToCheck.toLowerCase();
  
  if (jidLower.includes('@g.us')) return true;
  if (jidLower.includes('@broadcast')) return true;
  if (jidLower.includes('@newsletter')) return true;
  if (jidLower.includes('@community')) return true;
  
  // 2. Pattern-based detection for WhatsApp groups (fallback)
  // Modern WhatsApp groups: 120363 + 12 digits = 18 total digits
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Match modern WhatsApp group pattern: starts with 120363 and has exactly 18 digits
  if (/^120363\d{12}$/.test(digitsOnly)) {
    return true;
  }
  
  // Legacy WhatsApp group format: phoneNumber-timestamp (e.g., 5511996444573-1449097597)
  // Groups in this format have a hyphen separating the creator's number from timestamp
  if (/-\d+$/.test(phone) && !phone.includes('@')) {
    return true;
  }
  
  // 3. Avoid false positives: numbers >15 digits that don't match known patterns
  // are likely malformed MSISDNs, not groups
  return false;
}

/**
 * Normalize phone number for Brazilian SMS (operadora format)
 * Converts E.164 (+5511999999999) to operator format (11999999999)
 * Automatically adds 9th digit for mobile numbers when missing
 * 
 * @param phone - Phone number in any format (E.164, with/without +55, etc)
 * @returns Object with normalized number and validation info
 * 
 * @example
 * normalizeBrazilianSMS('+5564999526870') // { number: '64999526870', valid: true }
 * normalizeBrazilianSMS('+553891620033')  // { number: '38991620033', valid: true, ninthDigitAdded: true }
 * normalizeBrazilianSMS('11987654321')    // { number: '11987654321', valid: true }
 */
export function normalizeBrazilianSMS(phone: string): {
  number: string;
  valid: boolean;
  original: string;
  ninthDigitAdded?: boolean;
  isLandline?: boolean;
  error?: string;
} {
  const original = phone;
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Remove country code 55 if present (Brazilian numbers start with 55)
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.substring(2);
  }
  
  // Validate minimum length (DDD + 8 digits = 10)
  if (digits.length < 10) {
    return {
      number: digits,
      valid: false,
      original,
      error: `Número muito curto: ${digits.length} dígitos (mínimo 10)`
    };
  }
  
  // Extract DDD (first 2 digits)
  const ddd = digits.substring(0, 2);
  const localNumber = digits.substring(2);
  
  // Validate DDD (11-99, excluding invalid ranges)
  const dddNum = parseInt(ddd, 10);
  if (dddNum < 11 || dddNum > 99) {
    return {
      number: digits,
      valid: false,
      original,
      error: `DDD inválido: ${ddd}`
    };
  }
  
  // Check if it's a landline (starts with 2, 3, 4, or 5)
  const firstLocalDigit = localNumber.charAt(0);
  const isLandline = ['2', '3', '4', '5'].includes(firstLocalDigit);
  
  // Landlines have 8 digits after DDD
  if (isLandline) {
    if (localNumber.length === 8) {
      return {
        number: digits,
        valid: true,
        original,
        isLandline: true
      };
    }
    return {
      number: digits,
      valid: false,
      original,
      isLandline: true,
      error: `Telefone fixo deve ter 8 dígitos após DDD, encontrado: ${localNumber.length}`
    };
  }
  
  // Mobile numbers (start with 6, 7, 8, or 9)
  // After 2016 migration, all mobile numbers should have 9 digits (starting with 9)
  
  // Already has 9 digits - check if starts with 9
  if (localNumber.length === 9) {
    if (localNumber.startsWith('9')) {
      return {
        number: digits,
        valid: true,
        original
      };
    }
    // 9 digits but doesn't start with 9 - likely invalid
    return {
      number: digits,
      valid: false,
      original,
      error: `Celular com 9 dígitos deve começar com 9, encontrado: ${firstLocalDigit}`
    };
  }
  
  // Has 8 digits - need to add 9th digit
  if (localNumber.length === 8) {
    // Mobile numbers (6, 7, 8, 9) need the 9 prefix added
    if (['6', '7', '8', '9'].includes(firstLocalDigit)) {
      const normalizedNumber = `${ddd}9${localNumber}`;
      return {
        number: normalizedNumber,
        valid: true,
        original,
        ninthDigitAdded: true
      };
    }
  }
  
  // Invalid length
  return {
    number: digits,
    valid: false,
    original,
    error: `Quantidade de dígitos inválida após DDD: ${localNumber.length} (esperado 8 ou 9)`
  };
}
