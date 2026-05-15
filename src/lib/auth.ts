export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getCloserSession(): { closerId: string; closerNome: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("closer_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCloserSession(closerId: string, closerNome: string) {
  localStorage.setItem("closer_session", JSON.stringify({ closerId, closerNome }));
}

export function clearCloserSession() {
  localStorage.removeItem("closer_session");
}
