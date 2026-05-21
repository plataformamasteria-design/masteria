/**
 * Verificação de sessão reutilizável para route handlers.
 *
 * Uso:
 *   const { user, error } = await verifySession();
 *   if (error) return error;
 *   // user contém SessionPayload com employeeId, role, nome, etc.
 */
import { NextResponse } from "next/server";
import { getUserSession } from "@/app/actions";
import type { SessionPayload } from "@/lib/session";

interface VerifyResult {
  user: SessionPayload | null;
  error: NextResponse | null;
}

/**
 * Verifica se o usuário está autenticado via cookie JWT usando o getUserSession real.
 */
export async function verifySession(): Promise<VerifyResult> {
  try {
    const session = await getUserSession();

    if (session.error || !session.user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: "Sessão inválida ou expirada" },
          { status: 401 }
        ),
      };
    }

    if (!session.user.id) {
      return {
        user: null,
        error: NextResponse.json(
          { error: "Sessão sem identificação de usuário" },
          { status: 401 }
        ),
      };
    }

    // Map the user to SessionPayload to avoid breaking dependent code
    const mappedUser: SessionPayload = {
      employeeId: session.user.id,
      role: (session.user.role as any) || "admin",
      entityId: session.user.companyId || null,
      nome: session.user.name || "Usuário",
    };

    return { user: mappedUser, error: null };
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
