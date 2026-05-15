/**
 * Match logic: GHL lead → Google Calendar event.
 * A lead is considered "matched" if ANY of these conditions is true:
 * a) Lead name (normalized) appears in event title OR description
 * b) Lead phone (last 8 digits) appears in event title OR description
 * c) Lead email appears in attendees or description
 *
 * If none match → lead is orphan.
 */
import type { CalendarEvent } from "@/lib/google-calendar";

export interface GhlLeadForMatch {
  id: string;
  name: string;
  phone: string;
  email: string;
}

/**
 * Normalize text: lowercase, remove accents, trim.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Extract last 8 digits from a phone number.
 */
function phoneLast8(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-8);
}

/**
 * Check if a lead has a matching event in the calendar.
 */
export function leadHasMatchingEvent(
  lead: GhlLeadForMatch,
  events: CalendarEvent[]
): boolean {
  const leadNameNorm = normalize(lead.name);
  const leadPhone8 = lead.phone ? phoneLast8(lead.phone) : "";
  const leadEmail = lead.email ? lead.email.toLowerCase().trim() : "";

  // Skip match if lead has no identifiable info
  if (!leadNameNorm && !leadPhone8 && !leadEmail) return false;

  for (const ev of events) {
    const titleNorm = normalize(ev.summary);
    const descNorm = normalize(ev.description || "");
    const searchText = titleNorm + " " + descNorm;

    // a) Name match (need at least 3 chars to avoid false positives)
    if (leadNameNorm.length >= 3 && searchText.includes(leadNameNorm)) {
      return true;
    }

    // b) Phone match (last 8 digits)
    if (leadPhone8.length === 8) {
      const rawText = ev.summary + " " + (ev.description || "");
      const textDigits = rawText.replace(/\D/g, "");
      if (textDigits.includes(leadPhone8)) {
        return true;
      }
    }

    // c) Email match in attendees or description
    if (leadEmail) {
      const attendeeEmails = ev.attendees.map((a) => a.email.toLowerCase());
      if (attendeeEmails.includes(leadEmail)) {
        return true;
      }
      if (descNorm.includes(leadEmail)) {
        return true;
      }
    }
  }

  return false;
}
