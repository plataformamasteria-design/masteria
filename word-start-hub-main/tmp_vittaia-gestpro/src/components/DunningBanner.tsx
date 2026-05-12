import { AlertTriangle, X, CreditCard } from "lucide-react";
import { useState } from "react";
import { useOverduePayments } from "@/hooks/useOverduePayments";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DunningBanner() {
  const { hasOverdue, overdueCount, totalOwed, oldestDueDate, isLoading } = useOverduePayments();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  if (isLoading || !hasOverdue || dismissed) return null;

  const isCritical = overdueCount >= 2;

  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 text-sm border-b ${
        isCritical
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400"
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />

      <div className="flex-1 min-w-0">
        {isCritical ? (
          <span className="font-semibold">
            ⚠️ Sua organização possui {overdueCount} faturas pendentes (R$ {totalOwed.toFixed(2)}) e está sujeita a desativação.
          </span>
        ) : (
          <span>
            Você possui {overdueCount} fatura{overdueCount > 1 ? "s" : ""} pendente{overdueCount > 1 ? "s" : ""} no valor de R$ {totalOwed.toFixed(2)}
            {oldestDueDate && (
              <> — vencimento: {format(new Date(oldestDueDate), "dd/MM/yyyy", { locale: ptBR })}</>
            )}
          </span>
        )}
      </div>

      <button
        onClick={() => navigate("/meu-plano")}
        className={`shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
          isCritical
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-yellow-500 text-white hover:bg-yellow-600"
        }`}
      >
        <CreditCard className="h-3 w-3 inline mr-1" />
        Pagar
      </button>

      {!isCritical && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
