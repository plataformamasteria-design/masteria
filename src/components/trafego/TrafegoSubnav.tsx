"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronDown, Gauge, Filter, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRAFEGO_NAV_AREAS, findActiveTrafegoItem } from "./trafego-nav-config";

const AREA_ICONS: Record<string, React.ElementType> = {
  cockpit: Gauge,
  "funil-criativos": Filter,
  estrategia: TrendingUp,
};

const LS_KEY = "marketing_nav_collapsed";

function loadCollapsedState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}

function saveCollapsedState(state: Record<string, boolean>) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export function TrafegoSubnav() {
  const pathname = usePathname();
  const activeInfo = findActiveTrafegoItem(pathname);

  const [collapsedAreas, setCollapsedAreas] = useState<Record<string, boolean>>(() => {
    const saved = loadCollapsedState();
    if (activeInfo) saved[activeInfo.area.id] = false;
    return saved;
  });

  useEffect(() => {
    if (activeInfo && collapsedAreas[activeInfo.area.id]) {
      setCollapsedAreas((prev) => {
        const next = { ...prev, [activeInfo.area.id]: false };
        saveCollapsedState(next);
        return next;
      });
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleArea = (areaId: string) => {
    if (activeInfo?.area.id === areaId && !collapsedAreas[areaId]) return;
    setCollapsedAreas((prev) => {
      const next = { ...prev, [areaId]: !prev[areaId] };
      saveCollapsedState(next);
      return next;
    });
  };

  return (
    <>
      {/* Desktop sidebar nav */}
      <nav className="hidden md:block space-y-1">
        {TRAFEGO_NAV_AREAS.map((area) => {
          const isCollapsed = collapsedAreas[area.id] ?? false;
          const AreaIcon = AREA_ICONS[area.id] || Gauge;

          return (
            <div key={area.id}>
              <button
                onClick={() => toggleArea(area.id)}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors",
                  "hover:bg-white/[0.04]",
                  area.colorClass
                )}
              >
                <AreaIcon size={14} className={area.iconColorClass} />
                <span className="flex-1 text-left">{area.label}</span>
                <ChevronDown
                  size={12}
                  className={cn("transition-transform duration-200", isCollapsed && "-rotate-90")}
                />
              </button>

              {!isCollapsed && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {area.items.map((item) => {
                    const isActive = item.paths.some(
                      (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?")
                    );
                    const borderColor = area.id === "cockpit" ? "#60a5fa" : area.id === "funil-criativos" ? "#a78bfa" : "#34d399";
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md text-xs font-medium transition-colors duration-200 px-2.5 py-1.5",
                          isActive
                            ? "bg-white/[0.08] text-foreground border-l-2 -ml-[9px] pl-[11px]"
                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                        )}
                        style={isActive ? { borderColor } : undefined}
                      >
                        <item.icon size={14} className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Mobile bottom bar */}
      <MobileBottomBar />
    </>
  );
}

function MobileBottomBar() {
  const pathname = usePathname();
  const [openArea, setOpenArea] = useState<string | null>(null);
  const activeInfo = findActiveTrafegoItem(pathname);

  const isMarketingRoute = pathname.startsWith("/marketing");
  if (!isMarketingRoute) return null;

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-2 flex justify-around items-center">
        {TRAFEGO_NAV_AREAS.map((area) => {
          const AreaIcon = AREA_ICONS[area.id] || Gauge;
          const isAreaActive = activeInfo?.area.id === area.id;

          return (
            <button
              key={area.id}
              onClick={() => setOpenArea(openArea === area.id ? null : area.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-colors relative",
                isAreaActive ? "text-foreground" : "text-muted-foreground",
                openArea === area.id && "bg-white/[0.06]"
              )}
            >
              <AreaIcon size={20} className={isAreaActive ? area.iconColorClass : undefined} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{area.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      {openArea && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setOpenArea(null)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl border-t border-border p-4 pb-8 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {TRAFEGO_NAV_AREAS.filter((a) => a.id === openArea).map((area) => (
              <div key={area.id}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn("text-sm font-bold uppercase tracking-widest", area.colorClass)}>
                    {area.label}
                  </h3>
                  <button onClick={() => setOpenArea(null)} className="p-1 rounded-md hover:bg-white/[0.06]">
                    <X size={18} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="space-y-1">
                  {area.items.map((item) => {
                    const isActive = item.paths.some(
                      (p) => pathname === p || pathname.startsWith(p + "/")
                    );
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setOpenArea(null)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-white/[0.08] text-foreground"
                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                        )}
                      >
                        <item.icon size={18} className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="md:hidden h-16" />
    </>
  );
}
