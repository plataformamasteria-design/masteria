import { cn } from "@/lib/utils";
import {
  Key,
  Search,
  Database,
  Webhook,
  Radio,
  Tag,
  MessageSquare,
  Bot,
  Settings,
  Zap,
  Building2,
  BookOpen,
  Layers,
  Terminal,
  BellRing,
  Image,
  Facebook
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export interface SidebarSection {
  id: string;
  label: string;
  icon: React.ElementType;
  group?: string;
  badge?: string;
}

const sectionGroups = [
  {
    label: "Endpoints",
    sections: [
      { id: 'queries', label: 'Queries', icon: Search },
      { id: 'message-history', label: 'Histórico', icon: MessageSquare },
      { id: 'mutations', label: 'Mutations', icon: Database },
      { id: 'messages', label: 'Mensagens', icon: MessageSquare },
      { id: 'tags', label: 'Tags', icon: Tag },
      { id: 'human-assist', label: 'Escalar', icon: Bot },
    ]
  },
  {
    label: "Integrações n8n",
    sections: [
      { id: 'n8n-nodes', label: 'Nodes Pré-feitos', icon: Webhook },
    ]
  },
  {
    label: "Documentação",
    sections: [
      { id: 'schema', label: 'Database Schema', icon: BookOpen },
    ]
  }
];

// Flat list for export
const sections: SidebarSection[] = sectionGroups.flatMap(g => g.sections);

interface ApiDocSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ApiDocSidebar({
  activeSection,
  onSectionChange,
  searchQuery,
  onSearchChange
}: ApiDocSidebarProps) {
  const filteredGroups = searchQuery
    ? sectionGroups.map(g => ({
      ...g,
      sections: g.sections.filter(s =>
        s.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(g => g.sections.length > 0)
    : sectionGroups;

  return (
    <aside className="w-64 md:w-72 shrink-0 border-r border-border/60 bg-card/80 backdrop-blur-md overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Terminal className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Developer</h2>
              <p className="text-[11px] text-muted-foreground">API & Configurações</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar seção..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-8 bg-muted/50 border-border/40 text-xs placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="px-3 space-y-5">
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.sections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;

                    return (
                      <button
                        key={section.id}
                        onClick={() => onSectionChange(section.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150",
                          "hover:bg-muted/60",
                          isActive
                            ? "bg-primary/10 text-primary font-medium shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground/70"
                        )} />
                        <span className="flex-1 text-left truncate">{section.label}</span>
                        {section.badge && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono border-primary/30 text-primary/80">
                            {section.badge}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/30">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
            <span>HTTP REST API</span>
            <span className="font-mono">v2.0</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export { sections };
