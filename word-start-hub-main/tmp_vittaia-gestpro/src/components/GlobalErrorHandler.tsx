import { useEffect } from "react";

import { toast } from "@/hooks/use-toast";
import { parseEdgeFunctionError } from "@/lib/edge-function-error";

function includesNotOnWhatsApp(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("number_not_on_whatsapp") ||
    t.includes("não está registrado no whatsapp") ||
    t.includes("nao esta registrado no whatsapp") ||
    t.includes("not registered on whatsapp")
  );
}

function isNotOnWhatsAppError(reason: unknown): { message?: string } | null {
  const parsed = parseEdgeFunctionError(reason);
  const code = parsed.code;
  const message = parsed.message;

  if (code === "number_not_on_whatsapp") return { message };
  if (typeof message === "string" && includesNotOnWhatsApp(message)) return { message };

  // Sometimes the error is only representable via String(reason)
  try {
    const text = typeof reason === "string" ? reason : String(reason);
    if (includesNotOnWhatsApp(text)) return { message };
  } catch {
    // ignore
  }

  return null;
}

/**
 * Prevents expected backend validation errors from surfacing as uncaught
 * runtime errors (e.g. `number_not_on_whatsapp`) that can lead to blank screens
 * in some runtimes.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const info = isNotOnWhatsAppError(event.reason);
      if (!info) return;

      // Mark as handled for this known/expected case.
      event.preventDefault();

      toast({
        title: "Número não encontrado",
        description: info.message || "Este número não está registrado no WhatsApp.",
        variant: "destructive",
      });
    };

    const onError = (event: ErrorEvent) => {
      const info = isNotOnWhatsAppError(event.error || event.message);
      if (!info) return;

      // Mark as handled for this known/expected case.
      event.preventDefault();

      toast({
        title: "Número não encontrado",
        description: info.message || "Este número não está registrado no WhatsApp.",
        variant: "destructive",
      });
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
