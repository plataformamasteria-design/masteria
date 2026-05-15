"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

export function TabLoading({ message = "Sincronizando dados de anúncios..." }: { message?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <div className="fixed inset-0 w-[100vw] h-[100vh] z-[99999] flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden backdrop-blur-md saturate-150 bg-black/10">
      <div className="relative flex flex-col items-center gap-8">
        <div className="relative flex items-center justify-center w-28 h-28">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>

        <p className="text-[12px] font-medium tracking-[0.1em] text-foreground/70 animate-pulse text-center">
           {message}
        </p>
      </div>
    </div>
  );

  if (!mounted) return null;

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
