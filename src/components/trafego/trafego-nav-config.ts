import {
  MonitorPlay, Brain, TrendingUp, Palette, Layers, Radio, Tag,
  FileBarChart, Presentation, CalendarDays, Settings2, FileInput,
} from "lucide-react";


/**
 * Configuração da navegação do módulo de Tráfego/Marketing no MasterIA.
 * Adaptado do Comarka para usar rotas /marketing/* em vez de /trafego/*.
 */

export interface TrafegoNavItem {
  id: string;
  href: string;
  label: string;
  icon: React.ElementType;
  paths: string[];
}

export interface TrafegoNavArea {
  id: string;
  label: string;
  colorClass: string;
  iconColorClass: string;
  items: TrafegoNavItem[];
}

export const TRAFEGO_NAV_AREAS: TrafegoNavArea[] = [
  {
    id: "cockpit",
    label: "COCKPIT",
    colorClass: "text-blue-400",
    iconColorClass: "text-blue-400",
    items: [
      {
        id: "visao-geral",
        href: "/marketing/visao-geral",
        label: "Visão Geral",
        icon: MonitorPlay,
        paths: ["/marketing/visao-geral"],
      },
      {
        id: "gerenciar",
        href: "/marketing/gerenciar",
        label: "Gerenciar",
        icon: Settings2,
        paths: ["/marketing/gerenciar"],
      },
      {
        id: "formularios",
        href: "/marketing/formularios",
        label: "Formulários",
        icon: FileInput,
        paths: ["/marketing/formularios"],
      },

      {
        id: "calendario",
        href: "/marketing/calendario",
        label: "Calendário",
        icon: CalendarDays,
        paths: ["/marketing/calendario"],
      },
      {
        id: "ia-insights",
        href: "/marketing/ad-intelligence",
        label: "IA Insights",
        icon: Brain,
        paths: ["/marketing/ad-intelligence", "/marketing/alertas"],
      },
    ],
  },
  {
    id: "funil-criativos",
    label: "FUNIL & CRIATIVOS",
    colorClass: "text-violet-400",
    iconColorClass: "text-violet-400",
    items: [
      {
        id: "campanhas",
        href: "/marketing/campanhas",
        label: "Campanhas",
        icon: Layers,
        paths: ["/marketing/campanhas", "/marketing/estrutura"],
      },
      {
        id: "conjuntos",
        href: "/marketing/campanhas?nivel=conjuntos&expand=all",
        label: "↳ Conjuntos",
        icon: Radio,
        paths: ["/marketing/conjuntos"],
      },
      {
        id: "anuncios",
        href: "/marketing/campanhas?nivel=anuncios&expand=all",
        label: "↳ Anúncios",
        icon: Tag,
        paths: ["/marketing/anuncios"],
      },
      {
        id: "criativos",
        href: "/marketing/criativos",
        label: "Análise de Criativos",
        icon: Palette,
        paths: ["/marketing/criativos", "/marketing/biblioteca"],
      },
    ],
  },
  {
    id: "estrategia",
    label: "ESTRATÉGIA",
    colorClass: "text-emerald-400",
    iconColorClass: "text-emerald-400",
    items: [
      {
        id: "relatorios",
        href: "/marketing/relatorios",
        label: "Relatórios",
        icon: FileBarChart,
        paths: ["/marketing/relatorios"],
      },
      {
        id: "apresentacao",
        href: "/marketing/apresentacao",
        label: "Apresentação",
        icon: Presentation,
        paths: ["/marketing/apresentacao"],
      },
    ],
  },
];

/** Todas as paths de marketing (para detecção de rota ativa) */
export const ALL_MARKETING_PATHS = TRAFEGO_NAV_AREAS.flatMap((a) =>
  a.items.flatMap((i) => i.paths)
);

/** Encontra a área e item ativos dado o pathname */
export function findActiveTrafegoItem(pathname: string) {
  for (const area of TRAFEGO_NAV_AREAS) {
    for (const item of area.items) {
      if (item.paths.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"))) {
        return { area, item };
      }
    }
  }
  return null;
}
