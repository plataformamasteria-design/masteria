/**
 * AI Budget Guard — verifica sessão + limite de tokens antes de chamadas IA.
 *
 * Uso nas rotas:
 *   const guard = await checkAIBudget(route);
 *   if (guard.error) return guard.error;
 *   // ... callAI(...)
 *   await logAIUsage(guard.userId, provider, model, tokensUsed, route);
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-admin";

const DAILY_TOKEN_LIMIT = 50_000;

interface BudgetCheck {
  userId: string;
  error: NextResponse | null;
}

/**
 * Verifica sessão autenticada e se o usuário não excedeu o limite diário.
 * Para rotas de cron (system), pular auth e usar userId fixo "system".
 */
export async function checkAIBudget(
  route: string,
  opts?: { skipAuth?: boolean }
): Promise<BudgetCheck> {
  // Auth check
  if (!opts?.skipAuth) {
    const session = await getSession();
    if (!session) {
      return {
        userId: "",
        error: NextResponse.json(
          { error: "Não autenticado" },
          { status: 401 }
        ),
      };
    }

    const userId = session.employeeId;
    const budgetError = await checkTokenBudget(userId);
    if (budgetError) {
      return { userId, error: budgetError };
    }

    return { userId, error: null };
  }

  // System/cron route — sem limite de budget
  return { userId: "system", error: null };
}

async function checkTokenBudget(userId: string): Promise<NextResponse | null> {
  try {
    const since = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data } = await supabaseAdmin
      .from("ai_usage_log")
      .select("tokens_used")
      .eq("user_id", userId)
      .gte("created_at", since);

    const totalTokens = (data || []).reduce(
      (sum, row) => sum + (row.tokens_used || 0),
      0
    );

    if (totalTokens >= DAILY_TOKEN_LIMIT) {
      return NextResponse.json(
        {
          error: `Limite de ${DAILY_TOKEN_LIMIT.toLocaleString()} tokens/24h excedido. Usado: ${totalTokens.toLocaleString()}`,
        },
        { status: 429 }
      );
    }
  } catch {
    // Se a tabela não existir ou der erro, não bloquear o usuário
  }

  return null;
}

/**
 * Registra uso de tokens na ai_usage_log.
 * Estima tokens se o provider não retornar contagem exata.
 */
export async function logAIUsage(
  userId: string,
  provider: string,
  model: string,
  tokensUsed: number,
  route: string
) {
  try {
    await supabaseAdmin.from("ai_usage_log").insert({
      user_id: userId,
      provider,
      model,
      tokens_used: tokensUsed,
      route,
    });
  } catch {
    // Log silencioso — não travar a resposta da IA
  }
}

/**
 * Estima tokens de uma string (approximação: 1 token ≈ 4 caracteres).
 * Usado quando o provider não retorna contagem exata de tokens.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
