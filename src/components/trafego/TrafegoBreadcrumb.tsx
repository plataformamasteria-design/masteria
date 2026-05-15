"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Megaphone } from "lucide-react";
import { findActiveTrafegoItem } from "./trafego-nav-config";

export function TrafegoBreadcrumb() {
  const pathname = usePathname();
  const active = findActiveTrafegoItem(pathname);

  if (!active) return null;

  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-3">
      <Megaphone size={12} className="shrink-0" />
      <Link href="/marketing/visao-geral" className="hover:text-foreground transition-colors">
        Marketing
      </Link>
      <ChevronRight size={10} className="shrink-0" />
      <span className={active.area.colorClass}>{active.area.label}</span>
      <ChevronRight size={10} className="shrink-0" />
      <span className="text-foreground">{active.item.label}</span>
    </div>
  );
}
