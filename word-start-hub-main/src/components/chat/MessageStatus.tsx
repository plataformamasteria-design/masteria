import React from "react";
import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";

type OptimisticStatus = "sending" | "error";

interface MessageStatusProps {
  /** Outgoing messages only */
  optimisticStatus?: OptimisticStatus;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  className?: string;
}

export function MessageStatus({
  optimisticStatus,
  deliveredAt,
  readAt,
  failedAt,
  errorMessage,
  className,
}: MessageStatusProps) {
  // WhatsApp-like:
  // - Clock: sending
  // - AlertCircle: failed
  // - ✓: sent
  // - ✓✓: delivered
  // - ✓✓ (colored): read

  if (optimisticStatus === "sending") {
    return (
      <span className={className} aria-label="Enviando">
        <Clock className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (optimisticStatus === "error" || failedAt) {
    return (
      <span className={className} title={errorMessage || "Falha ao enviar"} aria-label="Falha ao enviar">
        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
      </span>
    );
  }

  if (readAt) {
    return (
      <span className={className} aria-label="Lida">
        <CheckCheck className="h-3.5 w-3.5 text-primary" />
      </span>
    );
  }

  if (deliveredAt) {
    return (
      <span className={className} aria-label="Entregue">
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <span className={className} aria-label="Enviada">
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}
