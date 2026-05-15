import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET || "comarka-ads-session-secret-2026");
const COOKIE_NAME = "session_token";

export interface SessionPayload {
  employeeId: string;
  role: "admin" | "closer" | "sdr";
  entityId: string | null;
  nome: string;
  usuario?: string;
  cargo?: string;
}

// Super-admin: único usuário com controle total sobre todos (inclusive admins/diretores/heads).
// Fixo, não configurável pela UI.
export const SUPER_ADMIN_USUARIO = "lucas.santos";

export function isSuperAdmin(session: SessionPayload | null): boolean {
  return !!session && session.usuario === SUPER_ADMIN_USUARIO;
}

// Cargos que o Head pode gerenciar (operacional + vendas)
const HEAD_MANAGEABLE_CARGOS = ["closer", "sdr", "trafego", "tráfego", "pleno", "junior", "júnior", "desenvolvimento"];

export function canManageCargo(session: SessionPayload | null, targetCargo: string): boolean {
  if (!session) return false;
  if (isSuperAdmin(session)) return true;
  const actorCargo = (session.cargo || "").toLowerCase();
  const target = (targetCargo || "").toLowerCase();
  if (actorCargo === "head") {
    return HEAD_MANAGEABLE_CARGOS.includes(target);
  }
  // Admin não super-admin: pode gerenciar tudo menos admin/diretor
  if (session.role === "admin") {
    return !["admin", "diretor"].includes(target);
  }
  return false;
}

// 8 horas de expiração (28800 segundos)
const SESSION_DURATION = "8h";

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(SESSION_DURATION)
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 28800, // 8 hours
    path: "/",
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}
