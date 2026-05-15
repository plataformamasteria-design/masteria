"use client";

import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";

export function InsightRedirect() {
  return (
    <Link href="/dashboard" className="block">
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10">
        <Lightbulb size={16} className="text-primary shrink-0" />
        <span className="text-sm text-muted-foreground">
          Alertas e insights disponíveis no <strong className="text-foreground">Dashboard principal</strong>
        </span>
        <ArrowRight size={14} className="text-primary ml-auto shrink-0" />
      </div>
    </Link>
  );
}
