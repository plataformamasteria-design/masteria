"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MonitorPlay, Settings2, Brain, Palette, FileBarChart, FileInput } from "lucide-react";
import { cn } from "@/lib/utils";

const TOP_NAV_ITEMS = [
  { id: "visao-geral", href: "/marketing/visao-geral", label: "Visão Geral", icon: MonitorPlay, paths: ["/marketing/visao-geral"] },
  { id: "gerenciar", href: "/marketing/gerenciar", label: "Gerenciar", icon: Settings2, paths: ["/marketing/gerenciar"] },
  { id: "formularios", href: "/marketing/formularios", label: "Formulários", icon: FileInput, paths: ["/marketing/formularios"] },
  { id: "ia-insights", href: "/marketing/ad-intelligence", label: "IA Insights", icon: Brain, paths: ["/marketing/ad-intelligence", "/marketing/alertas"] },
  { id: "criativos", href: "/marketing/criativos", label: "Análise de Criativos", icon: Palette, paths: ["/marketing/criativos", "/marketing/biblioteca"] },
  { id: "relatorios", href: "/marketing/relatorios", label: "Relatórios", icon: FileBarChart, paths: ["/marketing/relatorios"] },
];


export function TrafegoSubnav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
      {TOP_NAV_ITEMS.map((item) => {
        const isActive = item.paths.some(
          (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?")
        );

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap border border-transparent",
              isActive
                ? "bg-primary text-primary-foreground border-primary/20 shadow-md shadow-primary/10"
                : "bg-black/5 dark:bg-white/5 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground"
            )}
          >
            <item.icon size={16} className={isActive ? "opacity-100" : "opacity-70"} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
