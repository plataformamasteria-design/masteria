"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const AutomationFlowEditor = dynamic(
  () => import("@/components/automations/AutomationFlowEditor").then((mod) => mod.AutomationFlowEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex w-full h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-3 text-sm text-zinc-400">Carregando Editor Visual...</span>
      </div>
    ),
  }
);

export default function AutomationEditorPage() {
    return (
        <div className="w-full h-[calc(100vh-4rem)] flex flex-col">
            <AutomationFlowEditor />
        </div>
    );
}
