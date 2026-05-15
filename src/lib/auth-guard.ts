/**
 * Verificação de sessão reutilizável para route handlers.
 *
 * Uso:
 *   const { user, error } = await verifySession();
 *   if (error) return error;
 *   // user contém SessionPayload com employeeId, role, nome, etc.
 */
import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/session";

interface VerifyResult {
  user: SessionPayload | null;
  error: NextResponse | null;
}

/**
 * Verifica se o usuário está autenticado via cookie JWT.
 * Retorna { user, error } — se error !== null, retornar direto na rota.
 *
 * O token JWT é verificado por jose (assinatura + expiração).
 * Se o token estiver expirado, jose retorna null e o usuário recebe 401.
 */
export async function verifySession(): Promise<VerifyResult> {
  try {
    const session = await getSession();

    if (!session) {
      return {
        user: null,
        error: NextResponse.json(
          { error: "Sessão inválida ou expirada" },
          { status: 401 }
        ),
      };
    }

    if (!session.employeeId) {
      return {
        user: null,
        error: NextResponse.json(
          { error: "Sessão sem identificação de usuário" },
          { status: 401 }
        ),
      };
    }

    return { user: session, error: null };
  } catch {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Erro ao verificar sessão" },
        { status: 401 }
      ),
    };
  }
}

/**
 * Verifica sessão e exige role admin.
 */
export async function verifyAdminSession(): Promise<VerifyResult> {
  return requireRole("admin");
}

/**
 * Verifica sessão e exige que o usuário tenha um dos roles permitidos.
 * Uso: const { user, error } = await requireRole("admin", "gestor");
 */
export async function requireRole(...allowedRoles: SessionPayload["role"][]): Promise<VerifyResult> {
  const result = await verifySession();
  if (result.error) return result;

  if (!allowedRoles.includes(result.user!.role)) {
    return {
      user: result.user,
      error: NextResponse.json(
        { error: "Permissão insuficiente", required: allowedRoles, actual: result.user!.role },
        { status: 403 }
      ),
    };
  }

  return result;
}
